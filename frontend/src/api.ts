import axios, { isAxiosError } from "axios";
import type { RouteCalculationResponse, RouteCheckpoint, RouteMetrics } from "./types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4040";

// Dedicated Axios client instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface LocationSearchResult {
  name: string;
  latitude: number;
  longitude: number;
  admin: string;
  country: string;
}

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

export interface ApiErrorData {
  message?: string;
  error?: string;
  details?: unknown;
}

export function extractApiErrorMessage(error: unknown, fallbackMessage = "An unexpected error occurred."): string {
  if (isAxiosError(error)) {
    if (axios.isCancel(error) || error.code === "ERR_CANCELED") {
      return "Request was cancelled.";
    }
    if (error.code === "ECONNABORTED") {
      return "Route weather evaluation timed out. Please retry or choose a larger checkpoint interval (25 or 50 miles).";
    }
    if (error.response) {
      const data = error.response.data as ApiErrorData | string | undefined;
      if (typeof data === "string" && data.trim()) {
        return data;
      }
      if (data && typeof data === "object") {
        if (data.message) return data.message;
        if (data.error) return data.error;
        if (data.details) {
          return typeof data.details === "string" ? data.details : JSON.stringify(data.details);
        }
      }
      return `Server returned error status ${error.response.status}.`;
    }
    if (error.request) {
      return "Unable to connect to the routing backend. Verify the Django server is running on port 4040.";
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const response = await apiClient.get<{ results: LocationSearchResult[] }>("/api/geocoding/search/", {
      params: { q: query.trim() },
      signal,
    });
    return response.data.results || [];
  } catch (err) {
    if (axios.isCancel(err)) return [];
    console.warn("Location search error:", err);
    return [];
  }
}

export async function fetchRouteEvaluation(
  params: CalculateRouteParams,
  signal?: AbortSignal
): Promise<RouteCalculationResponse> {
  try {
    const response = await apiClient.post<RouteCalculationResponse>("/api/routes/calculate/", params, { signal });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractApiErrorMessage(error, "Failed to calculate routes and weather risks."));
  }
}

export async function fetchTimelineUpdate(
  params: TimelineUpdateParams,
  signal?: AbortSignal
): Promise<TimelineUpdateResponse> {
  try {
    const response = await apiClient.post<TimelineUpdateResponse>("/api/routes/forecast-timeline/", params, { signal });
    return response.data;
  } catch (error: unknown) {
    throw new Error(extractApiErrorMessage(error, "Failed to evaluate timeline weather update."));
  }
}
