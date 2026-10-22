import type { RouteCalculationResponse, RouteCheckpoint, RouteMetrics } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export interface CalculateRouteParams {
  origin: string;
  destination: string;
  departure_time: string;
  cargo_weight_lbs: number;
  checkpoint_interval_miles: number;
}

export interface TimelineUpdateParams {
  offset_hours: number;
  cargo_weight_lbs: number;
  total_distance_miles: number;
  checkpoints: RouteCheckpoint[];
}

export interface TimelineUpdateResponse {
  offset_hours: number;
  metrics: RouteMetrics;
  checkpoints: RouteCheckpoint[];
}

export async function fetchRouteEvaluation(params: CalculateRouteParams): Promise<RouteCalculationResponse> {
  const resp = await fetch(`${API_BASE_URL}/api/routes/calculate/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    const message = errorData.message || errorData.error || (errorData.details ? JSON.stringify(errorData.details) : `Server responded with status ${resp.status}`);
    throw new Error(message);
  }

  return resp.json();
}

export async function fetchTimelineUpdate(params: TimelineUpdateParams): Promise<TimelineUpdateResponse> {
  const resp = await fetch(`${API_BASE_URL}/api/routes/forecast-timeline/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    const message = errorData.message || errorData.error || `Timeline update error ${resp.status}`;
    throw new Error(message);
  }

  return resp.json();
}
