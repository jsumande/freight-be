"""Domain data models and contracts for weather-aware routing."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any

from routing_engine.domain.enums import RiskLevel, RecommendationStatus


@dataclass(frozen=True)
class Coordinate:
    latitude: float
    longitude: float

    def to_dict(self) -> Dict[str, float]:
        return {"latitude": self.latitude, "longitude": self.longitude}


@dataclass
class WeatherObservation:
    """Weather metrics captured or forecasted at a specific location and time."""
    wind_speed_mph: Optional[float]
    rainfall_in_hr: Optional[float]
    snowfall_in_hr: Optional[float]
    temperature_f: Optional[float] = None
    weather_code: Optional[int] = None
    condition_description: str = "Unknown"
    forecast_time: Optional[datetime] = None
    is_available: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "wind_speed_mph": round(self.wind_speed_mph, 1) if self.wind_speed_mph is not None else None,
            "rainfall_in_hr": round(self.rainfall_in_hr, 3) if self.rainfall_in_hr is not None else None,
            "snowfall_in_hr": round(self.snowfall_in_hr, 2) if self.snowfall_in_hr is not None else None,
            "temperature_f": round(self.temperature_f, 1) if self.temperature_f is not None else None,
            "condition_description": self.condition_description,
            "forecast_time": self.forecast_time.isoformat() if self.forecast_time else None,
            "is_available": self.is_available,
        }


@dataclass
class CheckpointRisk:
    """Risk evaluation for an individual checkpoint."""
    overall_risk: RiskLevel
    wind_risk: RiskLevel
    rain_risk: RiskLevel
    snow_risk: RiskLevel
    weight_override_applied: bool = False
    override_reason: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_risk": self.overall_risk.value,
            "wind_risk": self.wind_risk.value,
            "rain_risk": self.rain_risk.value,
            "snow_risk": self.snow_risk.value,
            "weight_override_applied": self.weight_override_applied,
            "override_reason": self.override_reason,
            "details": self.details,
        }


@dataclass
class RouteCheckpoint:
    """A sampled location along the route with timing, weather, and evaluated risk."""
    index: int
    coordinate: Coordinate
    cumulative_miles: float
    segment_miles: float  # Represented distance for this checkpoint (Voronoi midpoint attribution)
    estimated_arrival_time: datetime
    weather: WeatherObservation
    risk: CheckpointRisk

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "latitude": self.coordinate.latitude,
            "longitude": self.coordinate.longitude,
            "cumulative_miles": round(self.cumulative_miles, 2),
            "segment_miles": round(self.segment_miles, 2),
            "estimated_arrival_time": self.estimated_arrival_time.isoformat(),
            "weather": self.weather.to_dict(),
            "risk": self.risk.to_dict(),
        }


@dataclass
class RouteMetrics:
    """Aggregated distance-based risk metrics for a route."""
    severe_risk_miles: float
    high_risk_miles: float
    moderate_risk_miles: float
    low_risk_miles: float
    no_travel_miles: float
    unknown_risk_miles: float
    average_risk_score: float
    has_no_travel: bool
    is_safe: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "severe_risk_miles": round(self.severe_risk_miles, 2),
            "high_risk_miles": round(self.high_risk_miles, 2),
            "moderate_risk_miles": round(self.moderate_risk_miles, 2),
            "low_risk_miles": round(self.low_risk_miles, 2),
            "no_travel_miles": round(self.no_travel_miles, 2),
            "unknown_risk_miles": round(self.unknown_risk_miles, 2),
            "average_risk_score": round(self.average_risk_score, 2),
            "has_no_travel": self.has_no_travel,
            "is_safe": self.is_safe,
        }


@dataclass
class RouteAlternative:
    """A viable route alternative evaluated against weather conditions."""
    id: str
    name: str
    summary: str
    distance_miles: float
    duration_seconds: float
    geometry: Dict[str, Any]  # GeoJSON LineString
    checkpoints: List[RouteCheckpoint]
    metrics: RouteMetrics
    rank: int = 0
    recommendation_reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "summary": self.summary,
            "distance_miles": round(self.distance_miles, 2),
            "duration_seconds": round(self.duration_seconds, 0),
            "duration_formatted": self.format_duration(self.duration_seconds),
            "geometry": self.geometry,
            "metrics": self.metrics.to_dict(),
            "checkpoints": [cp.to_dict() for cp in self.checkpoints],
            "rank": self.rank,
            "recommendation_reasons": self.recommendation_reasons,
        }

    @staticmethod
    def format_duration(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        if hours > 0:
            return f"{hours}h {minutes}m"
        return f"{minutes}m"


@dataclass
class RecommendationVerdict:
    """Final decision across all evaluated route alternatives."""
    recommended_route_id: Optional[str]
    status: RecommendationStatus
    reasoning: str
    all_routes_unsafe: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "recommended_route_id": self.recommended_route_id,
            "status": self.status.value,
            "reasoning": self.reasoning,
            "all_routes_unsafe": self.all_routes_unsafe,
        }
