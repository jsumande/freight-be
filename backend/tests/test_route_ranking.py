"""
Unit tests for distance-weighted route metrics aggregation, ranking priorities,
and No-Travel safety disqualification.
"""

from datetime import datetime
import pytest

from routing_engine.domain.enums import RiskLevel, RecommendationStatus
from routing_engine.domain.models import (
    Coordinate,
    WeatherObservation,
    CheckpointRisk,
    RouteCheckpoint,
    RouteMetrics,
    RouteAlternative,
)
from routing_engine.domain.route_ranking import (
    compute_checkpoint_representative_miles,
    aggregate_route_metrics,
    rank_and_evaluate_routes,
)


def make_dummy_checkpoint(index: int, cum_dist: float, seg_dist: float, risk_level: RiskLevel) -> RouteCheckpoint:
    return RouteCheckpoint(
        index=index,
        coordinate=Coordinate(40.0 + index * 0.1, -88.0),
        cumulative_miles=cum_dist,
        segment_miles=seg_dist,
        estimated_arrival_time=datetime(2026, 10, 23, 8, 0),
        weather=WeatherObservation(wind_speed_mph=15.0, rainfall_in_hr=0.0, snowfall_in_hr=0.0),
        risk=CheckpointRisk(
            overall_risk=risk_level,
            wind_risk=risk_level,
            rain_risk=RiskLevel.LOW,
            snow_risk=RiskLevel.LOW,
        ),
    )


def make_route(
    route_id: str,
    distance_miles: float,
    duration_seconds: float,
    severe_miles: float = 0.0,
    high_miles: float = 0.0,
    moderate_miles: float = 0.0,
    low_miles: float = 0.0,
    no_travel_miles: float = 0.0,
    average_risk: float = 1.0,
) -> RouteAlternative:
    has_no_travel = no_travel_miles > 0.0
    metrics = RouteMetrics(
        severe_risk_miles=severe_miles,
        high_risk_miles=high_miles,
        moderate_risk_miles=moderate_miles,
        low_risk_miles=low_miles,
        no_travel_miles=no_travel_miles,
        unknown_risk_miles=0.0,
        average_risk_score=average_risk,
        has_no_travel=has_no_travel,
        is_safe=not has_no_travel,
    )
    return RouteAlternative(
        id=route_id,
        name=f"Route {route_id}",
        summary=f"Highway {route_id}",
        distance_miles=distance_miles,
        duration_seconds=duration_seconds,
        geometry={"type": "LineString", "coordinates": []},
        checkpoints=[],
        metrics=metrics,
    )


class TestRepresentativeMilesConservation:
    """Verifies that Voronoi segment midpoints sum to the total route distance exactly."""

    def test_regular_intervals(self):
        # 100-mile route with 25-mile intervals: [0, 25, 50, 75, 100]
        cum_dists = [0.0, 25.0, 50.0, 75.0, 100.0]
        total = 100.0
        seg_miles = compute_checkpoint_representative_miles(cum_dists, total)

        assert len(seg_miles) == 5
        # Checkpoint 0: (25 - 0) / 2 = 12.5
        assert seg_miles[0] == pytest.approx(12.5)
        # Checkpoint 1: (50 - 0) / 2 = 25.0
        assert seg_miles[1] == pytest.approx(25.0)
        # Checkpoint 2: (75 - 25) / 2 = 25.0
        assert seg_miles[2] == pytest.approx(25.0)
        # Checkpoint 3: (100 - 50) / 2 = 25.0
        assert seg_miles[3] == pytest.approx(25.0)
        # Checkpoint 4: 100 - (75 + 100) / 2 = 12.5
        assert seg_miles[4] == pytest.approx(12.5)

        assert sum(seg_miles) == pytest.approx(total)

    def test_irregular_geometry(self):
        cum_dists = [0.0, 8.2, 33.7, 49.1, 72.0, 104.5]
        total = 104.5
        seg_miles = compute_checkpoint_representative_miles(cum_dists, total)
        assert sum(seg_miles) == pytest.approx(total)


class TestRouteRankingPriorities:
    """
    Verifies priority ordering:
    1. Fewest miles classified as Severe
    2. Fewest miles classified as High
    3. Lowest average risk
    4. Shortest estimated travel time
    """

    def test_priority_1_fewest_severe_miles(self):
        # Route A has fewer severe miles than Route B, even if Route B is faster and shorter
        route_a = make_route("A", distance_miles=300, duration_seconds=18000, severe_miles=10.0, high_miles=50.0)
        route_b = make_route("B", distance_miles=250, duration_seconds=14000, severe_miles=25.0, high_miles=0.0)

        ranked, verdict = rank_and_evaluate_routes([route_b, route_a])
        assert ranked[0].id == "A"
        assert verdict.recommended_route_id == "A"

    def test_priority_2_fewest_high_miles(self):
        # Both routes have 0 severe miles, Route A has fewer high miles
        route_a = make_route("A", distance_miles=300, duration_seconds=18000, severe_miles=0.0, high_miles=20.0)
        route_b = make_route("B", distance_miles=250, duration_seconds=14000, severe_miles=0.0, high_miles=40.0)

        ranked, verdict = rank_and_evaluate_routes([route_b, route_a])
        assert ranked[0].id == "A"
        assert verdict.recommended_route_id == "A"

    def test_priority_3_lowest_average_risk(self):
        # Both routes have 0 severe and 0 high miles, Route A has lower average risk
        route_a = make_route("A", distance_miles=300, duration_seconds=18000, severe_miles=0.0, high_miles=0.0, average_risk=1.2)
        route_b = make_route("B", distance_miles=250, duration_seconds=14000, severe_miles=0.0, high_miles=0.0, average_risk=1.8)

        ranked, verdict = rank_and_evaluate_routes([route_b, route_a])
        assert ranked[0].id == "A"
        assert verdict.recommended_route_id == "A"

    def test_priority_4_shortest_duration(self):
        # Everything identical, shortest duration wins
        route_a = make_route("A", distance_miles=300, duration_seconds=15000, severe_miles=0.0, high_miles=0.0, average_risk=1.5)
        route_b = make_route("B", distance_miles=320, duration_seconds=17000, severe_miles=0.0, high_miles=0.0, average_risk=1.5)

        ranked, verdict = rank_and_evaluate_routes([route_b, route_a])
        assert ranked[0].id == "A"
        assert verdict.recommended_route_id == "A"


class TestNoTravelDisqualification:
    """Verifies that routes containing No Travel hazards are strictly disqualified."""

    def test_route_with_no_travel_cannot_be_recommended(self):
        # Route Fast has 5 miles of No Travel, Route Safe has 0 No Travel but 20 miles Severe
        route_fast = make_route("Fast", distance_miles=200, duration_seconds=10000, severe_miles=0.0, no_travel_miles=5.0)
        route_safe = make_route("Safe", distance_miles=350, duration_seconds=20000, severe_miles=20.0, no_travel_miles=0.0)

        ranked, verdict = rank_and_evaluate_routes([route_fast, route_safe])
        # Safe route must be ranked first and recommended
        assert ranked[0].id == "Safe"
        assert verdict.recommended_route_id == "Safe"
        assert verdict.status == RecommendationStatus.RECOMMENDED

    def test_all_routes_unsafe_reports_explicitly(self):
        # Both routes have No Travel
        route_1 = make_route("R1", distance_miles=200, duration_seconds=10000, no_travel_miles=15.0)
        route_2 = make_route("R2", distance_miles=220, duration_seconds=11000, no_travel_miles=30.0)

        ranked, verdict = rank_and_evaluate_routes([route_1, route_2])
        assert verdict.recommended_route_id is None
        assert verdict.status == RecommendationStatus.ALL_ROUTES_UNSAFE
        assert verdict.all_routes_unsafe is True
        assert "All viable route alternatives contain hazardous NO TRAVEL conditions" in verdict.reasoning
