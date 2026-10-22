"""
Route-Level Risk Aggregation and Ranking Engine

Calculates exact distance-weighted risk mileage across route checkpoints
and applies lexicographical ranking priorities:
1. Fewest miles classified as Severe
2. Fewest miles classified as High
3. Lowest distance-weighted average risk score
4. Shortest estimated travel time
"""

from typing import List, Tuple, Dict, Any, Optional
from routing_engine.domain.enums import RiskLevel, RecommendationStatus
from routing_engine.domain.models import (
    RouteCheckpoint,
    RouteMetrics,
    RouteAlternative,
    RecommendationVerdict,
)


def compute_checkpoint_representative_miles(cumulative_distances: List[float], total_distance: float) -> List[float]:
    """
    Computes distance represented by each checkpoint using 1D Voronoi segment midpoints.
    This guarantees that the sum of checkpoint representative distances equals the total route
    distance exactly, regardless of irregular checkpoint spacing or endpoints.

    For n checkpoints (0 to n-1):
    - Checkpoint 0: [0, (d_0 + d_1)/2] -> length = (d_1 - d_0) / 2
    - Checkpoint i: [(d_{i-1} + d_i)/2, (d_i + d_{i+1})/2] -> length = (d_{i+1} - d_{i-1}) / 2
    - Checkpoint n-1: [(d_{n-2} + d_{n-1})/2, total_distance] -> length = total_distance - (d_{n-2} + d_{n-1}) / 2
    """
    n = len(cumulative_distances)
    if n == 0:
        return []
    if n == 1:
        return [total_distance]

    segment_miles: List[float] = [0.0] * n

    # First checkpoint (origin)
    segment_miles[0] = (cumulative_distances[1] - cumulative_distances[0]) / 2.0

    # Intermediate checkpoints
    for i in range(1, n - 1):
        segment_miles[i] = (cumulative_distances[i + 1] - cumulative_distances[i - 1]) / 2.0

    # Final checkpoint (destination)
    midpoint_last = (cumulative_distances[n - 2] + cumulative_distances[n - 1]) / 2.0
    segment_miles[n - 1] = total_distance - midpoint_last

    # Numerical stabilization: ensure no negative miles if distance is identical
    segment_miles = [max(0.0, m) for m in segment_miles]

    # Normalize small floating-point residual to match total_distance exactly
    sum_miles = sum(segment_miles)
    if sum_miles > 0 and abs(sum_miles - total_distance) > 1e-6:
        ratio = total_distance / sum_miles
        segment_miles = [m * ratio for m in segment_miles]

    return segment_miles


def aggregate_route_metrics(checkpoints: List[RouteCheckpoint], total_distance: float) -> RouteMetrics:
    """
    Aggregates distance-weighted risk metrics for a route based on checkpoint assessments.
    """
    if not checkpoints or total_distance <= 0:
        return RouteMetrics(
            severe_risk_miles=0.0,
            high_risk_miles=0.0,
            moderate_risk_miles=0.0,
            low_risk_miles=0.0,
            no_travel_miles=0.0,
            unknown_risk_miles=0.0,
            average_risk_score=1.0,
            has_no_travel=False,
            is_safe=True,
        )

    severe_miles = 0.0
    high_miles = 0.0
    moderate_miles = 0.0
    low_miles = 0.0
    no_travel_miles = 0.0
    unknown_miles = 0.0
    weighted_score_sum = 0.0

    has_no_travel = False

    for cp in checkpoints:
        miles = cp.segment_miles
        risk = cp.risk.overall_risk

        if risk == RiskLevel.NO_TRAVEL:
            no_travel_miles += miles
            has_no_travel = True
        elif risk == RiskLevel.SEVERE:
            severe_miles += miles
        elif risk == RiskLevel.HIGH:
            high_miles += miles
        elif risk == RiskLevel.MODERATE:
            moderate_miles += miles
        elif risk == RiskLevel.LOW:
            low_miles += miles
        else:  # UNKNOWN
            unknown_miles += miles

        weighted_score_sum += risk.score_value * miles

    average_risk = weighted_score_sum / total_distance if total_distance > 0 else 1.0

    return RouteMetrics(
        severe_risk_miles=severe_miles,
        high_risk_miles=high_miles,
        moderate_risk_miles=moderate_miles,
        low_risk_miles=low_miles,
        no_travel_miles=no_travel_miles,
        unknown_risk_miles=unknown_miles,
        average_risk_score=average_risk,
        has_no_travel=has_no_travel,
        is_safe=(not has_no_travel),
    )


def rank_and_evaluate_routes(routes: List[RouteAlternative]) -> Tuple[List[RouteAlternative], RecommendationVerdict]:
    """
    Ranks viable route alternatives deterministically.

    Priorities in specified order:
    1. Fewest miles classified as Severe.
    2. Fewest miles classified as High.
    3. Lowest average risk score.
    4. Shortest estimated travel time.

    Disqualification policy:
    - Routes containing No Travel hazards are marked unsafe and cannot be recommended as safe.
    - If ALL routes contain No Travel hazards, the system explicitly reports ALL_ROUTES_UNSAFE.
    - Stable tie-breaker is applied using route ID / original list index.
    """
    if not routes:
        return [], RecommendationVerdict(
            recommended_route_id=None,
            status=RecommendationStatus.NO_ROUTES_FOUND,
            reasoning="No route alternatives were returned by the routing provider.",
            all_routes_unsafe=False,
        )

    # Key formulation for lexicographical comparison:
    # (
    #   is_disqualified (0 if safe, 1 if contains No Travel),
    #   severe_risk_miles (rounded to 3 decimals for float stability),
    #   high_risk_miles (rounded to 3 decimals),
    #   average_risk_score (rounded to 3 decimals),
    #   duration_seconds,
    #   stable_index
    # )
    indexed_routes = list(enumerate(routes))

    def ranking_key(item: Tuple[int, RouteAlternative]):
        idx, r = item
        disqualified = 1 if (r.metrics.has_no_travel or r.metrics.no_travel_miles > 0) else 0
        return (
            disqualified,
            round(r.metrics.severe_risk_miles, 3),
            round(r.metrics.high_risk_miles, 3),
            round(r.metrics.average_risk_score, 3),
            round(r.duration_seconds, 1),
            idx,  # stable tie-breaker
        )

    sorted_indexed = sorted(indexed_routes, key=ranking_key)

    ranked_routes: List[RouteAlternative] = []
    all_unsafe = all(r.metrics.has_no_travel for _, r in sorted_indexed)

    for rank_pos, (original_idx, route) in enumerate(sorted_indexed, start=1):
        route.rank = rank_pos
        reasons = []

        if route.metrics.has_no_travel:
            reasons.append(f"UNSAFE: Contains {route.metrics.no_travel_miles:.1f} miles of NO TRAVEL weather hazards.")
        else:
            reasons.append("Safe for commercial dispatch (no extreme wind or impassable weather).")

        reasons.append(f"Severe risk exposure: {route.metrics.severe_risk_miles:.1f} mi.")
        reasons.append(f"High risk exposure: {route.metrics.high_risk_miles:.1f} mi.")
        reasons.append(f"Average risk score: {route.metrics.average_risk_score:.2f} / 5.0.")
        reasons.append(f"Estimated transit duration: {RouteAlternative.format_duration(route.duration_seconds)}.")

        route.recommendation_reasons = reasons
        ranked_routes.append(route)

    top_route = ranked_routes[0]

    if all_unsafe:
        verdict = RecommendationVerdict(
            recommended_route_id=None,
            status=RecommendationStatus.ALL_ROUTES_UNSAFE,
            reasoning=(
                "All viable route alternatives contain hazardous NO TRAVEL conditions "
                "(excessive crosswinds or extreme precipitation exceeding safety thresholds). "
                "Dispatch is not recommended until weather clears."
            ),
            all_routes_unsafe=True,
        )
    elif top_route.metrics.has_no_travel:
        verdict = RecommendationVerdict(
            recommended_route_id=None,
            status=RecommendationStatus.ALL_ROUTES_UNSAFE,
            reasoning="No safe route meets commercial travel standards.",
            all_routes_unsafe=True,
        )
    else:
        verdict = RecommendationVerdict(
            recommended_route_id=top_route.id,
            status=RecommendationStatus.RECOMMENDED,
            reasoning=(
                f"{top_route.name or top_route.summary or 'Route 1'} is recommended: "
                f"Minimal severe risk exposure ({top_route.metrics.severe_risk_miles:.1f} mi), "
                f"lowest risk profile (score {top_route.metrics.average_risk_score:.2f}), "
                f"and estimated transit time of {RouteAlternative.format_duration(top_route.duration_seconds)}."
            ),
            all_routes_unsafe=False,
        )

    return ranked_routes, verdict
