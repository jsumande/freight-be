"""
Route Evaluation Orchestrator

Integrates Geocoding, Routing (OSRM), Checkpoint Generation, Weather Forecasting (Open-Meteo),
Risk Assessment, and Lexicographical Route Ranking into an end-to-end pipeline.
"""

from datetime import datetime, timezone
import logging
from typing import Dict, Any, List, Optional

from routing_engine.domain.models import (
    Coordinate,
    RouteCheckpoint,
    RouteAlternative,
    RecommendationVerdict,
)
from routing_engine.domain.risk_assessment import assess_checkpoint_risk
from routing_engine.domain.route_ranking import (
    compute_checkpoint_representative_miles,
    aggregate_route_metrics,
    rank_and_evaluate_routes,
)
from routing_engine.services.geocoding_service import geocode_location
from routing_engine.services.routing_service import (
    get_routing_service,
    METERS_TO_MILES,
    ROUTING_PROVIDER_LIMITATION,
)
from routing_engine.services.checkpoint_generator import generate_route_checkpoint_samples
from routing_engine.services.weather_service import OpenMeteoWeatherService

logger = logging.getLogger(__name__)


class RouteEvaluationOrchestrator:
    """Orchestrates route planning and weather risk evaluation."""

    def __init__(
        self,
        routing_service: Optional[Any] = None,
        weather_service: Optional[OpenMeteoWeatherService] = None,
    ):
        self.routing_service = routing_service or get_routing_service()
        self.weather_service = weather_service or OpenMeteoWeatherService()

    def evaluate_routes(
        self,
        origin_query: str,
        destination_query: str,
        departure_time: datetime,
        cargo_weight_lbs: float,
        checkpoint_interval_miles: float = 25.0,
    ) -> Dict[str, Any]:
        """
        Executes complete route evaluation workflow.
        """
        # 1. Geocode endpoints
        origin_geo = geocode_location(origin_query)
        dest_geo = geocode_location(destination_query)

        # 2. Fetch route alternatives from OSRM
        raw_routes, provider_msg = self.routing_service.get_route_alternatives(
            start_lat=origin_geo["latitude"],
            start_lon=origin_geo["longitude"],
            end_lat=dest_geo["latitude"],
            end_lon=dest_geo["longitude"],
        )

        evaluated_alternatives: List[RouteAlternative] = []

        for idx, raw in enumerate(raw_routes):
            route_id = f"route-{idx}"
            coords = raw.get("geometry", {}).get("coordinates", [])
            total_dist_miles = raw.get("distance", 0.0) * METERS_TO_MILES
            total_dur_seconds = float(raw.get("duration", 0.0))

            legs = raw.get("legs", [])
            summary_name = legs[0].get("summary", "") if legs else ""
            if not summary_name:
                summary_name = f"Alternative {idx + 1}"

            # 3. Generate checkpoints along geometry
            checkpoint_samples = generate_route_checkpoint_samples(
                coordinates=coords,
                total_distance_miles=total_dist_miles,
                total_duration_seconds=total_dur_seconds,
                departure_time=departure_time,
                raw_route=raw,
                interval_miles=checkpoint_interval_miles,
            )

            # Compute exact representative distance for each checkpoint
            cum_distances = [s["cumulative_miles"] for s in checkpoint_samples]
            rep_miles = compute_checkpoint_representative_miles(cum_distances, total_dist_miles)

            checkpoints: List[RouteCheckpoint] = []
            for sample_idx, sample in enumerate(checkpoint_samples):
                coord = sample["coordinate"]
                eta = sample["estimated_arrival_time"]
                seg_m = rep_miles[sample_idx]

                # 4. Fetch weather observation at checkpoint coordinate & ETA
                weather_obs = self.weather_service.get_observation_at_time(coord, eta)

                # 5. Assess checkpoint risk with cargo weight
                risk_eval = assess_checkpoint_risk(weather_obs, cargo_weight_lbs)

                cp = RouteCheckpoint(
                    index=sample["index"],
                    coordinate=coord,
                    cumulative_miles=sample["cumulative_miles"],
                    segment_miles=seg_m,
                    estimated_arrival_time=eta,
                    weather=weather_obs,
                    risk=risk_eval,
                )
                checkpoints.append(cp)

            # 6. Aggregate route metrics
            metrics = aggregate_route_metrics(checkpoints, total_dist_miles)

            alt = RouteAlternative(
                id=route_id,
                name=f"Route {idx + 1}: {summary_name}",
                summary=summary_name,
                distance_miles=total_dist_miles,
                duration_seconds=total_dur_seconds,
                geometry=raw.get("geometry", {}),
                checkpoints=checkpoints,
                metrics=metrics,
            )
            evaluated_alternatives.append(alt)

        # 7. Apply lexicographical ranking and recommendation verdict
        ranked_routes, verdict = rank_and_evaluate_routes(evaluated_alternatives)

        return {
            "query": {
                "origin": origin_geo,
                "destination": dest_geo,
                "departure_time": departure_time.isoformat(),
                "cargo_weight_lbs": cargo_weight_lbs,
                "checkpoint_interval_miles": checkpoint_interval_miles,
            },
            "routes": [r.to_dict() for r in ranked_routes],
            "recommendation": verdict.to_dict(),
            "provider_status": {
                "message": provider_msg,
                "routes_returned_count": len(ranked_routes),
            },
            "limitations": [
                ROUTING_PROVIDER_LIMITATION,
                "Open-Meteo forecasts update hourly; microclimate gusts and transient squalls between forecast cycles may differ.",
            ],
        }
