"""
Integration tests for services, serializers, and API endpoints.
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import pytest
from rest_framework.test import APIClient

from routing_engine.domain.enums import RiskLevel, RecommendationStatus
from routing_engine.domain.models import Coordinate, WeatherObservation
from routing_engine.services.geocoding_service import geocode_location, GeocodingError, parse_coordinate_string
from routing_engine.services.routing_service import (
    haversine_distance_miles,
    are_routes_meaningfully_distinct,
    OSRMRoutingService,
    RoutingError,
)
from routing_engine.services.checkpoint_generator import (
    build_cumulative_polyline_distances,
    interpolate_duration_at_distance,
    interpolate_coordinate_at_distance,
    generate_route_checkpoint_samples,
)
from routing_engine.services.weather_service import OpenMeteoWeatherService


class TestGeocodingService:
    def test_parse_direct_coordinates(self):
        coord = parse_coordinate_string("41.8781, -87.6298")
        assert coord is not None
        assert coord.latitude == pytest.approx(41.8781)
        assert coord.longitude == pytest.approx(-87.6298)

        coord2 = parse_coordinate_string("39.7392 -104.9903")
        assert coord2 is not None

        invalid = parse_coordinate_string("not a coordinate")
        assert invalid is None

    @patch("requests.get")
    def test_geocode_location_success(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "results": [
                {
                    "name": "Chicago",
                    "admin1": "Illinois",
                    "country": "United States",
                    "latitude": 41.85,
                    "longitude": -87.65,
                    "timezone": "America/Chicago",
                }
            ]
        }
        mock_get.return_value = mock_resp

        res = geocode_location("Chicago, IL")
        assert res["latitude"] == pytest.approx(41.85)
        assert res["longitude"] == pytest.approx(-87.65)
        assert "Chicago" in res["name"]

    def test_geocode_empty_string_raises(self):
        with pytest.raises(GeocodingError):
            geocode_location("")


class TestCheckpointGeometryAndInterpolation:
    def test_polyline_cumulative_distances(self):
        # 3 points along equator approx 1 degree apart (~69 miles each)
        coords = [[0.0, 0.0], [1.0, 0.0], [2.0, 0.0]]
        cum = build_cumulative_polyline_distances(coords)
        assert len(cum) == 3
        assert cum[0] == 0.0
        assert cum[1] > 60.0
        assert cum[2] > cum[1]

    def test_interpolate_duration_monotonic(self):
        profile = [(0.0, 0.0), (50.0, 3600.0), (100.0, 7200.0)]
        # Midpoint of first segment: 25 miles -> 1800s
        t_mid = interpolate_duration_at_distance(profile, 25.0)
        assert t_mid == pytest.approx(1800.0)

        t_end = interpolate_duration_at_distance(profile, 100.0)
        assert t_end == pytest.approx(7200.0)

    def test_generate_route_checkpoint_samples(self):
        # Straight line from (0,0) to (0, 100 miles)
        # 1 degree lat is approx 69.0 miles
        coords = [[0.0, 0.0], [0.0, 1.45]]
        total_dist = 100.0
        total_dur = 7200.0
        departure = datetime(2026, 10, 23, 8, 0, tzinfo=timezone.utc)
        raw_route = {"legs": [{"steps": [{"distance": 160934.0, "duration": 7200.0}]}]}

        samples = generate_route_checkpoint_samples(
            coordinates=coords,
            total_distance_miles=total_dist,
            total_duration_seconds=total_dur,
            departure_time=departure,
            raw_route=raw_route,
            interval_miles=25.0,
        )

        assert len(samples) >= 4
        # Verify origin and destination are sampled
        assert samples[0]["cumulative_miles"] == 0.0
        assert samples[0]["estimated_arrival_time"] == departure
        assert samples[-1]["cumulative_miles"] == pytest.approx(samples[-1]["cumulative_miles"])


@pytest.mark.django_db
class TestRouteAPIEndpoints:
    def setup_method(self):
        self.client = APIClient()

    def test_health_check(self):
        resp = self.client.get("/api/health/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_swagger_and_openapi_endpoints(self):
        schema_resp = self.client.get("/api/schema/")
        assert schema_resp.status_code == 200
        assert "openapi" in schema_resp.content.decode()

        docs_resp = self.client.get("/api/docs/")
        assert docs_resp.status_code == 200
        assert "SwaggerUIBundle" in docs_resp.content.decode()

        redoc_resp = self.client.get("/api/redoc/")
        assert redoc_resp.status_code == 200
        assert "redoc" in redoc_resp.content.decode().lower()

    def test_calculate_validation_failure(self):
        # Missing required fields
        resp = self.client.post("/api/routes/calculate/", {}, format="json")
        assert resp.status_code == 400
        data = resp.json()
        assert "details" in data
        assert "origin" in data["details"]
        assert "destination" in data["details"]
        assert "cargo_weight_lbs" in data["details"]

    @patch("routing_engine.services.orchestrator.geocode_location")
    @patch("routing_engine.services.orchestrator.OSRMRoutingService.get_route_alternatives")
    @patch("routing_engine.services.orchestrator.OpenMeteoWeatherService.get_observation_at_time")
    def test_calculate_route_end_to_end_mocked(self, mock_weather, mock_routes, mock_geocode):
        mock_geocode.side_effect = [
            {"query": "Chicago", "name": "Chicago, IL", "latitude": 41.87, "longitude": -87.62, "timezone": "America/Chicago"},
            {"query": "Denver", "name": "Denver, CO", "latitude": 39.73, "longitude": -104.99, "timezone": "America/Denver"},
        ]

        mock_routes.return_value = (
            [
                {
                    "geometry": {"type": "LineString", "coordinates": [[-87.62, 41.87], [-104.99, 39.73]]},
                    "distance": 1600000.0,  # ~994 miles
                    "duration": 54000.0,
                    "legs": [{"summary": "I-80 W", "steps": []}],
                }
            ],
            "Found 1 primary route alternative.",
        )

        # Mild weather
        mock_weather.return_value = WeatherObservation(
            wind_speed_mph=15.0,
            rainfall_in_hr=0.02,
            snowfall_in_hr=0.0,
            temperature_f=65.0,
            condition_description="Clear",
            is_available=True,
        )

        payload = {
            "origin": "Chicago, IL",
            "destination": "Denver, CO",
            "cargo_weight_lbs": 35000,
            "checkpoint_interval_miles": 50,
        }

        resp = self.client.post("/api/routes/calculate/", payload, format="json")
        assert resp.status_code == 200
        data = resp.json()
        assert "routes" in data
        assert len(data["routes"]) == 1
        assert "recommendation" in data
        assert data["recommendation"]["status"] == RecommendationStatus.RECOMMENDED.value
        assert data["routes"][0]["metrics"]["is_safe"] is True

    @patch("routing_engine.services.weather_service.OpenMeteoWeatherService.get_observation_at_time")
    def test_forecast_timeline_reevaluation(self, mock_weather):
        mock_weather.return_value = WeatherObservation(
            wind_speed_mph=32.0,  # Moderate wind
            rainfall_in_hr=0.0,
            snowfall_in_hr=0.0,
            is_available=True,
        )

        payload = {
            "offset_hours": 12,
            "cargo_weight_lbs": 30000,
            "total_distance_miles": 100.0,
            "checkpoints": [
                {
                    "index": 0,
                    "latitude": 41.87,
                    "longitude": -87.62,
                    "cumulative_miles": 0.0,
                    "segment_miles": 12.5,
                    "estimated_arrival_time": "2026-10-23T08:00:00Z",
                },
                {
                    "index": 1,
                    "latitude": 41.50,
                    "longitude": -88.50,
                    "cumulative_miles": 50.0,
                    "segment_miles": 50.0,
                    "estimated_arrival_time": "2026-10-23T09:00:00Z",
                },
            ],
        }

        resp = self.client.post("/api/routes/forecast-timeline/", payload, format="json")
        assert resp.status_code == 200
        data = resp.json()
        assert data["offset_hours"] == 12
        assert "metrics" in data
        assert len(data["checkpoints"]) == 2
        assert data["checkpoints"][0]["risk"]["wind_risk"] == RiskLevel.MODERATE.value
