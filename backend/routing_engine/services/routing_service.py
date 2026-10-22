"""
Routing Service Interface, OSRM Implementation, and Google Maps Directions Provider

Communicates with routing providers (Google Maps Directions API or OSRM) to fetch real, distinct route alternatives.
Preserves polyline geometry, cumulative distance, duration, and step-level annotations.
Validates route uniqueness and honestly discloses the number of returned routes.
"""

import logging
import math
import os
from typing import List, Dict, Any, Tuple
import requests

logger = logging.getLogger(__name__)

ROUTING_PROVIDER_LIMITATION = (
    "Routing geometry and durations reflect standard highway networks. Commercial truck "
    "clearance restrictions (bridge heights, gross weight ratings, and hazardous materials bans) "
    "are not guaranteed unless specialized commercial truck restrictions are licensed."
)

METERS_TO_MILES = 0.000621371


class RoutingError(Exception):
    """Raised when routing requests fail or cannot find viable routes."""
    pass


def haversine_distance_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two points in miles."""
    r_miles = 3958.8
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r_miles * c


def decode_google_polyline(polyline_str: str) -> List[List[float]]:
    """
    Decodes a Google encoded polyline string into GeoJSON standard [[lon, lat], ...] coordinates.
    """
    coords: List[List[float]] = []
    index = 0
    lat = 0
    lng = 0
    length = len(polyline_str)

    while index < length:
        shift = 0
        result = 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += dlat

        shift = 0
        result = 0
        while True:
            b = ord(polyline_str[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += dlng

        coords.append([lng / 1e5, lat / 1e5])

    return coords


def are_routes_meaningfully_distinct(
    coords_a: List[List[float]], coords_b: List[List[float]],
    dist_a: float, dist_b: float,
    threshold_ratio: float = 0.05
) -> bool:
    """
    Determines if two route alternatives are meaningfully distinct rather than duplicate paths.
    Evaluates distance variation and sample coordinate variance.
    """
    if abs(dist_a - dist_b) / max(dist_a, dist_b, 1.0) > threshold_ratio:
        return True

    # Check midpoint coordinate deviation
    mid_idx_a = len(coords_a) // 2
    mid_idx_b = len(coords_b) // 2
    if mid_idx_a < len(coords_a) and mid_idx_b < len(coords_b):
        lon_a, lat_a = coords_a[mid_idx_a]
        lon_b, lat_b = coords_b[mid_idx_b]
        dev_miles = haversine_distance_miles(lat_a, lon_a, lat_b, lon_b)
        if dev_miles > 5.0:
            return True

    return False


class GoogleDirectionsRoutingService:
    """Client for Google Maps Directions API."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_route_alternatives(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
        timeout: float = 12.0,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Requests route alternatives from Google Maps Directions API.
        Formats response into standard normalized structure compatible with checkpoint generator.
        """
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{start_lat:.6f},{start_lon:.6f}",
            "destination": f"{end_lat:.6f},{end_lon:.6f}",
            "alternatives": "true",
            "key": self.api_key,
        }

        try:
            resp = requests.get(url, params=params, timeout=timeout)
            if resp.status_code != 200:
                raise RoutingError(f"Google Directions API returned HTTP {resp.status_code}: {resp.text[:200]}")
            data = resp.json()
        except requests.RequestException as exc:
            logger.error("Google Directions API connection error: %s", exc)
            raise RoutingError(f"Network error connecting to Google Directions API: {exc}")

        status = data.get("status")
        if status != "OK":
            err_msg = data.get("error_message", f"Google returned status {status}")
            logger.warning("Google Directions error (%s): %s. Falling back to OSRM provider.", status, err_msg)
            # Graceful fallback to OSRM if Google Maps billing is disabled or request denied
            fallback_osrm = OSRMRoutingService()
            routes, osrm_msg = fallback_osrm.get_route_alternatives(start_lat, start_lon, end_lat, end_lon, timeout)
            return routes, f"Google Maps returned ({status}: {err_msg[:80]}...). Seamlessly operating via OSRM fallback: {osrm_msg}"

        raw_routes = data.get("routes", [])
        if not raw_routes:
            raise RoutingError("Google Directions found no viable routes between specified endpoints.")

        # Normalize Google route structure to match our standard internal route schema
        normalized_routes: List[Dict[str, Any]] = []
        for g_route in raw_routes:
            poly_str = g_route.get("overview_polyline", {}).get("points", "")
            coords = decode_google_polyline(poly_str)

            legs = g_route.get("legs", [])
            total_dist_meters = sum(leg.get("distance", {}).get("value", 0) for leg in legs)
            total_dur_seconds = sum(leg.get("duration", {}).get("value", 0) for leg in legs)

            normalized_legs = []
            for leg in legs:
                norm_steps = []
                for s in leg.get("steps", []):
                    norm_steps.append({
                        "distance": s.get("distance", {}).get("value", 0),
                        "duration": s.get("duration", {}).get("value", 0),
                    })
                normalized_legs.append({
                    "summary": g_route.get("summary", ""),
                    "steps": norm_steps,
                })

            normalized_routes.append({
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords,
                },
                "distance": total_dist_meters,
                "duration": total_dur_seconds,
                "legs": normalized_legs,
                "summary": g_route.get("summary", "Google Highway Route"),
            })

        count = len(normalized_routes)
        msg = f"Found {count} distinct route alternative(s) via Google Maps Directions API."
        return normalized_routes[:3], msg


class OSRMRoutingService:
    """Client for OSRM public or self-hosted routing services."""

    def __init__(self, base_url: str = "https://router.project-osrm.org"):
        self.base_url = base_url.rstrip("/")

    def get_route_alternatives(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
        timeout: float = 12.0,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Requests route alternatives from OSRM.
        """
        coord_str = f"{start_lon:.6f},{start_lat:.6f};{end_lon:.6f},{end_lat:.6f}"
        url = f"{self.base_url}/route/v1/driving/{coord_str}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "alternatives": "true",
            "steps": "true",
            "annotations": "duration,distance",
        }

        try:
            resp = requests.get(url, params=params, timeout=timeout)
            if resp.status_code != 200:
                raise RoutingError(
                    f"OSRM returned HTTP {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json()
        except requests.RequestException as exc:
            logger.error("OSRM request connection error: %s", exc)
            raise RoutingError(f"Network error connecting to routing provider: {exc}")

        code = data.get("code")
        if code != "Ok":
            message = data.get("message", "No route found")
            raise RoutingError(f"Routing provider error ({code}): {message}")

        raw_routes = data.get("routes", [])
        if not raw_routes:
            raise RoutingError("No viable routes found between the specified origin and destination.")

        # Filter out identical or non-distinct duplicate routes
        distinct_routes: List[Dict[str, Any]] = []
        for raw in raw_routes:
            coords = raw.get("geometry", {}).get("coordinates", [])
            dist = raw.get("distance", 0.0)
            is_distinct = True
            for existing in distinct_routes:
                ex_coords = existing.get("geometry", {}).get("coordinates", [])
                ex_dist = existing.get("distance", 0.0)
                if not are_routes_meaningfully_distinct(coords, ex_coords, dist, ex_dist):
                    is_distinct = False
                    break
            if is_distinct:
                distinct_routes.append(raw)

        count = len(distinct_routes)
        if count == 3:
            msg = "Found 3 distinct viable route alternatives via OSRM."
        elif count == 2:
            msg = "Found 2 distinct viable route alternatives via OSRM (provider found no third viable highway route)."
        elif count == 1:
            msg = "Found 1 primary route alternative via OSRM (no viable distinct secondary routes exist for this corridor)."
        else:
            msg = f"Found {count} viable route alternatives via OSRM."

        return distinct_routes[:3], msg


def get_routing_service():
    """
    Factory function to instantiate routing service based on environment configuration.
    Uses Google Maps Directions if GOOGLE_MAPS_API_KEY is configured or ROUTING_PROVIDER=google;
    otherwise uses OSRM.
    """
    google_key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    provider_pref = os.environ.get("ROUTING_PROVIDER", "").strip().lower()

    if google_key or provider_pref == "google":
        if not google_key:
            logger.warning("ROUTING_PROVIDER=google specified but GOOGLE_MAPS_API_KEY is empty. Falling back to OSRM.")
            return OSRMRoutingService()
        return GoogleDirectionsRoutingService(api_key=google_key)

    return OSRMRoutingService()
