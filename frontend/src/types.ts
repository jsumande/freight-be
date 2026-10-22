export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "SEVERE" | "NO_TRAVEL" | "UNKNOWN";

export type RecommendationStatus = "RECOMMENDED" | "ALL_ROUTES_UNSAFE" | "NO_ROUTES_FOUND" | "DATA_UNAVAILABLE";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface WeatherObservation {
  wind_speed_mph: number | null;
  rainfall_in_hr: number | null;
  snowfall_in_hr: number | null;
  temperature_f?: number | null;
  condition_description: string;
  forecast_time: string | null;
  is_available: boolean;
}

export interface CheckpointRisk {
  overall_risk: RiskLevel;
  wind_risk: RiskLevel;
  rain_risk: RiskLevel;
  snow_risk: RiskLevel;
  weight_override_applied: boolean;
  override_reason: string | null;
  details?: Record<string, unknown>;
}

export interface RouteCheckpoint {
  index: number;
  latitude: number;
  longitude: number;
  cumulative_miles: number;
  segment_miles: number;
  estimated_arrival_time: string;
  weather: WeatherObservation;
  risk: CheckpointRisk;
}

export interface RouteMetrics {
  severe_risk_miles: number;
  high_risk_miles: number;
  moderate_risk_miles: number;
  low_risk_miles: number;
  no_travel_miles: number;
  unknown_risk_miles: number;
  average_risk_score: number;
  has_no_travel: boolean;
  is_safe: boolean;
}

export interface RouteAlternative {
  id: string;
  name: string;
  summary: string;
  distance_miles: number;
  duration_seconds: number;
  duration_formatted: string;
  geometry: {
    type: string;
    coordinates: [number, number][]; // [lon, lat]
  };
  checkpoints: RouteCheckpoint[];
  metrics: RouteMetrics;
  rank: number;
  recommendation_reasons: string[];
}

export interface RecommendationVerdict {
  recommended_route_id: string | null;
  status: RecommendationStatus;
  reasoning: string;
  all_routes_unsafe: boolean;
}

export interface RouteCalculationResponse {
  query: {
    origin: { query: string; name: string; latitude: number; longitude: number };
    destination: { query: string; name: string; latitude: number; longitude: number };
    departure_time: string;
    cargo_weight_lbs: number;
    checkpoint_interval_miles: number;
  };
  routes: RouteAlternative[];
  recommendation: RecommendationVerdict;
  provider_status: {
    message: string;
    routes_returned_count: number;
  };
  limitations: string[];
}
