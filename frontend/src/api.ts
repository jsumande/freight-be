import axios, { isAxiosError } from "axios";
import type { RouteCalculationResponse, RouteCheckpoint, RouteMetrics } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4040";

// Dedicated Axios client instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
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

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const response = await apiClient.get<{ results: LocationSearchResult[] }>("/api/geocoding/search/", {
      params: { q: query.trim() },
    });
    return response.data.results || [];
  } catch (err) {
    console.warn("Location search error:", err);
    return [];
  }
}

export async function fetchRouteEvaluation(params: CalculateRouteParams): Promise<RouteCalculationResponse> {
  try {
    const response = await apiClient.post<RouteCalculationResponse>("/api/routes/calculate/", params);
    return response.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response) {
      const data = error.response.data as Record<string, any>;
      const message =
        data.message ||
        data.error ||
        (data.details ? JSON.stringify(data.details) : `Server error: ${error.response.status}`);
      throw new Error(message);
    }
    if (isAxiosError(error) && error.request) {
      throw new Error("Unable to connect to the routing backend. Verify the Django server is running on port 4040.");
    }
    throw error;
  }
}

export async function fetchTimelineUpdate(params: TimelineUpdateParams): Promise<TimelineUpdateResponse> {
  try {
    const response = await apiClient.post<TimelineUpdateResponse>("/api/routes/forecast-timeline/", params);
    return response.data;
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response) {
      const data = error.response.data as Record<string, any>;
      const message =
        data.message ||
        data.error ||
        (data.details ? JSON.stringify(data.details) : `Server error: ${error.response.status}`);
      throw new Error(message);
    }
    throw error;
  }
}
