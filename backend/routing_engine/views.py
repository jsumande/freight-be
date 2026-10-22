"""
API Views for Weather-Aware Truck Routing with OpenAPI / Swagger Documentation
"""

from datetime import datetime, timezone, timedelta
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiResponse

from routing_engine.serializers import (
    RouteCalculationRequestSerializer,
    TimelineReevaluationRequestSerializer,
)
from routing_engine.services.orchestrator import RouteEvaluationOrchestrator
from routing_engine.services.geocoding_service import geocode_location, search_locations, GeocodingError
from routing_engine.services.routing_service import RoutingError
from routing_engine.services.weather_service import OpenMeteoWeatherService, WeatherProviderError
from routing_engine.domain.models import Coordinate, RouteCheckpoint
from routing_engine.domain.risk_assessment import assess_checkpoint_risk
from routing_engine.domain.route_ranking import aggregate_route_metrics

logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    """Basic health check to verify backend operational status."""

    @extend_schema(
        summary="Service Health Check",
        description="Returns operational status of the Weather-Aware Truck Routing API.",
        tags=["System"],
        responses={200: OpenApiResponse(description="API is operating normally")},
    )
    def get(self, request):
        return Response({"status": "healthy", "service": "weather-aware-truck-routing-api"})


class LocationSearchView(APIView):
    """
    GET /api/geocoding/search/?q={query}
    Autocomplete location search returning geographic suggestions for origin and destination inputs.
    """

    @extend_schema(
        summary="Search Address & Location Suggestions",
        description="Returns place/city suggestions based on map geocoding for interactive origin and destination search.",
        tags=["Routing & Weather Risk"],
        parameters=[
            {
                "name": "q",
                "type": str,
                "in": "query",
                "required": True,
                "description": "Location name, address, or partial search text (min 2 chars)",
            }
        ],
        responses={
            200: OpenApiResponse(description="List of matching locations with coordinates and formatted names."),
        },
    )
    def get(self, request):
        query = request.query_params.get("q", "")
        results = search_locations(query, count=5)
        return Response({"query": query, "results": results})


class RouteCalculationView(APIView):
    """
    POST /api/routes/calculate/
    Evaluates commercial truck routes based on forecasted weather hazards, cargo weight overrides,
    and returns ranked route alternatives.
    """

    @extend_schema(
        summary="Calculate and Rank Weather-Aware Routes",
        description=(
            "Calculates up to 3 distinct viable route alternatives between origin and destination, "
            "samples checkpoints at 10, 25, or 50 mile intervals, extracts forecast weather metrics, "
            "evaluates cargo-weight rollover risk overrides, and returns deterministically ranked routes."
        ),
        tags=["Routing & Weather Risk"],
        request=RouteCalculationRequestSerializer,
        responses={
            200: OpenApiResponse(description="Evaluated and ranked route alternatives with risk metrics."),
            400: OpenApiResponse(description="Validation error or address geocoding failure."),
            502: OpenApiResponse(description="Upstream routing or weather provider connection error."),
            500: OpenApiResponse(description="Internal processing error."),
        },
    )
    def post(self, request):
        serializer = RouteCalculationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Validation failed", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        departure_time = data.get("departure_time") or datetime.now(timezone.utc)

        orchestrator = RouteEvaluationOrchestrator()
        try:
            result = orchestrator.evaluate_routes(
                origin_query=data["origin"],
                destination_query=data["destination"],
                departure_time=departure_time,
                cargo_weight_lbs=data["cargo_weight_lbs"],
                checkpoint_interval_miles=float(data.get("checkpoint_interval_miles", 25.0)),
            )
            return Response(result, status=status.HTTP_200_OK)

        except GeocodingError as ge:
            logger.warning("Geocoding failed: %s", ge)
            return Response(
                {"error": "Geocoding failure", "message": str(ge)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except RoutingError as re:
            logger.warning("Routing failed: %s", re)
            return Response(
                {"error": "Routing failure", "message": str(re)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except WeatherProviderError as we:
            logger.error("Weather provider failed: %s", we)
            return Response(
                {"error": "Weather service failure", "message": str(we)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.exception("Unexpected error during route evaluation: %s", exc)
            return Response(
                {"error": "Internal processing error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ForecastTimelineView(APIView):
    """
    POST /api/routes/forecast-timeline/
    Re-evaluates checkpoint weather conditions and risk levels for an offset in hours (0 to 48 hours).
    Updates checkpoint risks and re-aggregates route metrics.
    """

    @extend_schema(
        summary="Re-evaluate Route at Forecast Horizon Offset",
        description=(
            "Re-evaluates checkpoint weather conditions and risk levels across the 48-hour forecast slider. "
            "Updates checkpoint risks and re-aggregates route metrics without recalculating route geometry."
        ),
        tags=["Routing & Weather Risk"],
        request=TimelineReevaluationRequestSerializer,
        responses={
            200: OpenApiResponse(description="Re-evaluated checkpoints and updated route metrics."),
            400: OpenApiResponse(description="Validation error in payload."),
        },
    )
    def post(self, request):
        serializer = TimelineReevaluationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": "Validation failed", "details": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        offset_hours = data["offset_hours"]
        cargo_weight = data["cargo_weight_lbs"]
        raw_checkpoints = data["checkpoints"]
        total_distance = data["total_distance_miles"]

        weather_svc = OpenMeteoWeatherService()
        updated_checkpoints: list = []

        now_utc = datetime.now(timezone.utc)
        target_departure = now_utc + timedelta(hours=offset_hours)

        for raw_cp in raw_checkpoints:
            lat = raw_cp.get("latitude")
            lon = raw_cp.get("longitude")
            cum_m = raw_cp.get("cumulative_miles", 0.0)
            seg_m = raw_cp.get("segment_miles", 0.0)
            idx = raw_cp.get("index", 0)

            # Parse original arrival time or calculate offset
            orig_eta_str = raw_cp.get("estimated_arrival_time")
            if orig_eta_str:
                orig_eta = datetime.fromisoformat(orig_eta_str)
                # Shift original ETA by offset_hours
                shifted_eta = orig_eta + timedelta(hours=offset_hours)
            else:
                shifted_eta = target_departure

            coord = Coordinate(latitude=float(lat), longitude=float(lon))
            obs = weather_svc.get_observation_at_time(coord, shifted_eta)
            risk = assess_checkpoint_risk(obs, cargo_weight)

            updated_checkpoints.append(RouteCheckpoint(
                index=idx,
                coordinate=coord,
                cumulative_miles=cum_m,
                segment_miles=seg_m,
                estimated_arrival_time=shifted_eta,
                weather=obs,
                risk=risk,
            ))

        metrics = aggregate_route_metrics(updated_checkpoints, total_distance)

        return Response({
            "offset_hours": offset_hours,
            "metrics": metrics.to_dict(),
            "checkpoints": [cp.to_dict() for cp in updated_checkpoints],
        }, status=status.HTTP_200_OK)
