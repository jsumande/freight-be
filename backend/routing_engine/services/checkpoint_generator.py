"""
Checkpoint Generator Service

Samples weather evaluation points along route geometry at exact intervals (10, 25, or 50 miles).
Interpolates exact geographic coordinates along polyline vertices.
Calculates ETA using routing step durations rather than a naive flat speed.
"""

from datetime import datetime, timedelta
import math
from typing import List, Dict, Any, Tuple
from routing_engine.domain.models import Coordinate
from routing_engine.services.routing_service import haversine_distance_miles, METERS_TO_MILES


def build_cumulative_polyline_distances(coordinates: List[List[float]]) -> List[float]:
    """
    Computes cumulative distance in miles for each coordinate vertex in the GeoJSON polyline.
    Coordinates are in [lon, lat] format.
    """
    n = len(coordinates)
    if n == 0:
        return []
    cum_miles = [0.0] * n
    total = 0.0
    for i in range(1, n):
        lon1, lat1 = coordinates[i - 1]
        lon2, lat2 = coordinates[i]
        d = haversine_distance_miles(lat1, lon1, lat2, lon2)
        total += d
        cum_miles[i] = total
    return cum_miles


def build_timing_profile(raw_route: Dict[str, Any], total_dist_miles: float, total_duration_seconds: float) -> List[Tuple[float, float]]:
    """
    Builds a monotonic (cumulative_distance_miles, cumulative_duration_seconds) profile
    from OSRM legs and steps to account for variable highway speeds, city streets, and mountain passes.
    """
    profile: List[Tuple[float, float]] = [(0.0, 0.0)]
    legs = raw_route.get("legs", [])
    current_dist = 0.0
    current_time = 0.0

    for leg in legs:
        steps = leg.get("steps", [])
        for step in steps:
            s_dist = step.get("distance", 0.0) * METERS_TO_MILES
            s_dur = step.get("duration", 0.0)
            current_dist += s_dist
            current_time += s_dur
            profile.append((current_dist, current_time))

    if len(profile) <= 1 or profile[-1][0] < 0.1:
        # Fallback to linear total route duration if steps are absent
        profile = [(0.0, 0.0), (total_dist_miles, total_duration_seconds)]
    else:
        # Ensure the final point matches the route totals
        profile.append((total_dist_miles, total_duration_seconds))

    # Sort and remove non-monotonic distance points
    cleaned_profile = [profile[0]]
    for p in profile[1:]:
        if p[0] > cleaned_profile[-1][0]:
            cleaned_profile.append(p)
    return cleaned_profile


def interpolate_duration_at_distance(profile: List[Tuple[float, float]], target_distance_miles: float) -> float:
    """
    Interpolates cumulative transit duration in seconds at a given distance along the route.
    """
    if target_distance_miles <= 0:
        return 0.0
    if not profile:
        return 0.0
    if target_distance_miles >= profile[-1][0]:
        return profile[-1][1]

    # Binary search or scan
    for i in range(len(profile) - 1):
        d0, t0 = profile[i]
        d1, t1 = profile[i + 1]
        if d0 <= target_distance_miles <= d1:
            segment_d = d1 - d0
            if segment_d <= 1e-6:
                return t0
            ratio = (target_distance_miles - d0) / segment_d
            return t0 + ratio * (t1 - t0)

    return profile[-1][1]


def interpolate_coordinate_at_distance(
    coordinates: List[List[float]],
    cum_distances: List[float],
    target_distance_miles: float,
) -> Coordinate:
    """
    Interpolates latitude and longitude at target_distance_miles along the polyline.
    Coordinates are [lon, lat].
    """
    n = len(coordinates)
    if n == 0:
        raise ValueError("Cannot interpolate on empty coordinates.")
    if target_distance_miles <= 0:
        return Coordinate(latitude=coordinates[0][1], longitude=coordinates[0][0])
    if target_distance_miles >= cum_distances[-1]:
        return Coordinate(latitude=coordinates[-1][1], longitude=coordinates[-1][0])

    for i in range(n - 1):
        d0 = cum_distances[i]
        d1 = cum_distances[i + 1]
        if d0 <= target_distance_miles <= d1:
            seg_len = d1 - d0
            if seg_len <= 1e-7:
                return Coordinate(latitude=coordinates[i][1], longitude=coordinates[i][0])
            ratio = (target_distance_miles - d0) / seg_len
            lon0, lat0 = coordinates[i]
            lon1, lat1 = coordinates[i + 1]
            interp_lat = lat0 + ratio * (lat1 - lat0)
            interp_lon = lon0 + ratio * (lon1 - lon0)
            return Coordinate(latitude=interp_lat, longitude=interp_lon)

    return Coordinate(latitude=coordinates[-1][1], longitude=coordinates[-1][0])


def generate_route_checkpoint_samples(
    coordinates: List[List[float]],
    total_distance_miles: float,
    total_duration_seconds: float,
    departure_time: datetime,
    raw_route: Dict[str, Any],
    interval_miles: float = 25.0,
) -> List[Dict[str, Any]]:
    """
    Generates checkpoint sample points along the route at the specified interval (10, 25, or 50 miles).
    Guarantees inclusion of origin (0 mi) and destination (total_distance_miles).

    Returns:
        List of dicts: [
            {
                "index": int,
                "coordinate": Coordinate,
                "cumulative_miles": float,
                "estimated_arrival_time": datetime,
            }, ...
        ]
    """
    if interval_miles not in (10.0, 25.0, 50.0):
        # Default fallback to 25 miles if invalid
        interval_miles = 25.0

    cum_distances = build_cumulative_polyline_distances(coordinates)
    if not cum_distances:
        return []

    # Use actual polyline cumulative length if OSRM reported distance slightly diverges
    effective_total_distance = cum_distances[-1]
    if effective_total_distance <= 0:
        effective_total_distance = total_distance_miles

    timing_profile = build_timing_profile(raw_route, effective_total_distance, total_duration_seconds)

    # Build target sample distances: 0.0, interval, 2*interval ... and destination
    target_distances: List[float] = [0.0]
    current = interval_miles
    # Stop before reaching destination to avoid duplicates
    while current < (effective_total_distance - 2.0):
        target_distances.append(current)
        current += interval_miles
    target_distances.append(effective_total_distance)

    samples: List[Dict[str, Any]] = []
    for idx, d in enumerate(target_distances):
        coord = interpolate_coordinate_at_distance(coordinates, cum_distances, d)
        dur_seconds = interpolate_duration_at_distance(timing_profile, d)
        eta = departure_time + timedelta(seconds=dur_seconds)

        samples.append({
            "index": idx,
            "coordinate": coord,
            "cumulative_miles": d,
            "estimated_arrival_time": eta,
        })

    return samples
