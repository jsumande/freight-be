import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RouteSearchForm } from "../components/RouteSearchForm";
import { RouteComparison } from "../components/RouteComparison";
import { CheckpointInspector } from "../components/CheckpointInspector";
import { RecommendationBanner } from "../components/RecommendationBanner";
import { ForecastSlider } from "../components/ForecastSlider";
import type { RouteAlternative, RouteCheckpoint, RecommendationVerdict } from "../types";

describe("Frontend Component Suite", () => {
  it("renders search form and triggers submit with accurate parameters", () => {
    const handleSearch = vi.fn();
    render(
      <RouteSearchForm
        origin="Chicago, IL"
        setOrigin={vi.fn()}
        destination="Milwaukee, WI"
        setDestination={vi.fn()}
        departureTime="2026-10-23T08:00"
        setDepartureTime={vi.fn()}
        cargoWeightLbs={35000}
        setCargoWeightLbs={vi.fn()}
        intervalMiles={25}
        setIntervalMiles={vi.fn()}
        onSearch={handleSearch}
        isLoading={false}
        isPickingOnMap={null}
        onTogglePickOnMap={vi.fn()}
      />
    );

    expect(screen.getByText("Trip & Cargo Parameters")).toBeDefined();
    const submitBtn = screen.getByText("Evaluate Route Safety");
    fireEvent.click(submitBtn);

    expect(handleSearch).toHaveBeenCalledTimes(1);
    const callArg = handleSearch.mock.calls[0][0];
    expect(callArg.origin).toBe("Chicago, IL");
    expect(callArg.destination).toBe("Milwaukee, WI");
    expect(callArg.cargo_weight_lbs).toBe(35000);
    expect(callArg.checkpoint_interval_miles).toBe(25);
  });

  it("renders RouteComparison with recommended and alternative badges", () => {
    const mockRoutes: RouteAlternative[] = [
      {
        id: "r1",
        name: "Route 1: I-80 W",
        summary: "I-80 W",
        distance_miles: 100.0,
        duration_seconds: 5400,
        duration_formatted: "1h 30m",
        geometry: { type: "LineString", coordinates: [] },
        checkpoints: [],
        metrics: {
          severe_risk_miles: 0.0,
          high_risk_miles: 10.0,
          moderate_risk_miles: 20.0,
          low_risk_miles: 70.0,
          no_travel_miles: 0.0,
          unknown_risk_miles: 0.0,
          average_risk_score: 1.4,
          has_no_travel: false,
          is_safe: true,
        },
        rank: 1,
        recommendation_reasons: ["Zero severe miles"],
      },
    ];

    const onSelect = vi.fn();
    render(
      <RouteComparison
        routes={mockRoutes}
        selectedRouteId="r1"
        onSelectRoute={onSelect}
        recommendedRouteId="r1"
        allRoutesUnsafe={false}
      />
    );

    expect(screen.getByText("RECOMMENDED")).toBeDefined();
    expect(screen.getByText("100.0 miles")).toBeDefined();
    expect(screen.getByText("0.0 mi")).toBeDefined(); // severe miles
  });

  it("displays CheckpointInspector details including cargo weight overrides", () => {
    const mockCp: RouteCheckpoint = {
      index: 3,
      latitude: 42.1,
      longitude: -87.9,
      cumulative_miles: 75.0,
      segment_miles: 25.0,
      estimated_arrival_time: "2026-10-23T10:00:00Z",
      weather: {
        wind_speed_mph: 38.0,
        rainfall_in_hr: 0.0,
        snowfall_in_hr: 0.0,
        temperature_f: 58.0,
        condition_description: "Overcast",
        forecast_time: "2026-10-23T10:00:00Z",
        is_available: true,
      },
      risk: {
        overall_risk: "SEVERE",
        wind_risk: "SEVERE",
        rain_risk: "LOW",
        snow_risk: "LOW",
        weight_override_applied: true,
        override_reason: "Cargo weight of 42,000 lbs in 38 mph wind triggers Severe risk override.",
      },
    };

    const onClose = vi.fn();
    render(<CheckpointInspector checkpoint={mockCp} onClose={onClose} cargoWeightLbs={42000} />);

    expect(screen.getByText("Checkpoint 3 Details")).toBeDefined();
    expect(screen.getByText("38 mph")).toBeDefined();
    expect(screen.getByText("CARGO-WEIGHT RISK OVERRIDE APPLIED")).toBeDefined();
    expect(
      screen.getByText("Cargo weight of 42,000 lbs in 38 mph wind triggers Severe risk override.")
    ).toBeDefined();
  });

  it("renders critical alert banner when all routes are unsafe", () => {
    const verdict: RecommendationVerdict = {
      recommended_route_id: null,
      status: "ALL_ROUTES_UNSAFE",
      reasoning: "All viable route alternatives contain hazardous NO TRAVEL conditions.",
      all_routes_unsafe: true,
    };

    render(
      <RecommendationBanner
        verdict={verdict}
        recommendedRoute={null}
        limitations={["General road networks"]}
      />
    );

    expect(screen.getByText("NO ROUTE SATISFIES COMMERCIAL SAFETY CRITERIA")).toBeDefined();
    expect(screen.getByText("CRITICAL DISPATCH ALERT")).toBeDefined();
  });

  it("triggers timeline offset updates when slider changes", () => {
    const onChange = vi.fn();
    render(
      <ForecastSlider
        offsetHours={0}
        onChangeOffset={onChange}
        baseDepartureTime="2026-10-23T08:00:00Z"
        isLoading={false}
      />
    );

    const plus12Btn = screen.getByText("+12h");
    fireEvent.click(plus12Btn);
    expect(onChange).toHaveBeenCalledWith(12);
  });
});
