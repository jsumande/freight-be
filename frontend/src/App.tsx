import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  RouteCalculationResponse,
  RouteCheckpoint,
} from "./types";
import {
  fetchRouteEvaluation,
  fetchTimelineUpdate,
  extractApiErrorMessage,
} from "./api";
import type { CalculateRouteParams } from "./api";
import { AppHeader } from "./components/AppHeader";
import { RouteMap } from "./components/RouteMap";
import { RouteSearchForm } from "./components/RouteSearchForm";
import { RouteComparison } from "./components/RouteComparison";
import { RecommendationBanner } from "./components/RecommendationBanner";
import { CheckpointInspector } from "./components/CheckpointInspector";
import { ForecastSlider } from "./components/ForecastSlider";
import { RiskRulesDrawer } from "./components/RiskRulesDrawer";
import { AlertCircle } from "lucide-react";

export function App() {
  const [data, setData] = useState<RouteCalculationResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<RouteCheckpoint | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form input state lifted for map pin picking integration
  const [origin, setOrigin] = useState("Chicago, IL");
  const [destination, setDestination] = useState("Milwaukee, WI");
  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [cargoWeightLbs, setCargoWeightLbs] = useState(35000);
  const [intervalMiles, setIntervalMiles] = useState<number>(25);

  // Map pin picking mode
  const [isPickingOnMap, setIsPickingOnMap] = useState<"origin" | "destination" | null>(null);

  // Timeline slider state (0 to 48 hours)
  const [timelineOffset, setTimelineOffset] = useState<number>(0);
  const [isTimelineLoading, setIsTimelineLoading] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const timelineAbortControllerRef = useRef<AbortController | null>(null);

  // Derived state
  const selectedRoute = useMemo(() => {
    if (!data) return null;
    return data.routes.find((r) => r.id === selectedRouteId) ?? data.routes[0] ?? null;
  }, [data, selectedRouteId]);

  const recommendedRoute = useMemo(() => {
    if (!data) return null;
    return data.routes.find((r) => r.id === data.recommendation.recommended_route_id) ?? data.routes[0] ?? null;
  }, [data]);

  const handleMapClickLocation = (lat: number, lon: number) => {
    const coordStr = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    if (isPickingOnMap === "origin") {
      setOrigin(coordStr);
    } else if (isPickingOnMap === "destination") {
      setDestination(coordStr);
    }
    setIsPickingOnMap(null);
  };

  const handleSearch = useCallback(async (params: CalculateRouteParams) => {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    setIsLoading(true);
    setErrorMessage(null);
    setTimelineOffset(0);
    setSelectedCheckpoint(null);

    try {
      const response = await fetchRouteEvaluation(params, controller.signal);
      if (controller.signal.aborted) return;
      setData(response);
      if (response.routes.length > 0) {
        const topRoute = response.recommendation.recommended_route_id || response.routes[0].id;
        setSelectedRouteId(topRoute);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setErrorMessage(
        extractApiErrorMessage(
          err,
          "Failed to calculate routes and weather risks. Verify the routing backend is reachable."
        )
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial calculation on mount & cleanup on unmount
  useEffect(() => {
    handleSearch({
      origin: "Chicago, IL",
      destination: "Milwaukee, WI",
      departure_time: new Date().toISOString(),
      cargo_weight_lbs: 35000,
      checkpoint_interval_miles: 25,
    });

    return () => {
      searchAbortControllerRef.current?.abort();
      timelineAbortControllerRef.current?.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [handleSearch]);

  // Re-evaluates current route checkpoints when timeline slider changes
  const handleTimelineChange = useCallback(
    (offsetHours: number) => {
      setTimelineOffset(offsetHours);

      if (!data || !selectedRoute || selectedRoute.checkpoints.length === 0) return;

      const currentRoute = selectedRoute;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (timelineAbortControllerRef.current) {
        timelineAbortControllerRef.current.abort();
      }

      setIsTimelineLoading(true);
      const reqId = ++activeRequestIdRef.current;

      debounceTimerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        timelineAbortControllerRef.current = controller;

        try {
          const update = await fetchTimelineUpdate(
            {
              offset_hours: offsetHours,
              cargo_weight_lbs: data.query.cargo_weight_lbs,
              total_distance_miles: currentRoute.distance_miles,
              checkpoints: currentRoute.checkpoints,
            },
            controller.signal
          );

          // Discard stale responses
          if (controller.signal.aborted || reqId !== activeRequestIdRef.current) return;

          setData((prev) => {
            if (!prev) return null;
            const updatedRoutes = prev.routes.map((r) => {
              if (r.id === selectedRouteId) {
                return {
                  ...r,
                  metrics: update.metrics,
                  checkpoints: update.checkpoints,
                };
              }
              return r;
            });

            return {
              ...prev,
              routes: updatedRoutes,
            };
          });

          // Update inspected checkpoint if one was active
          setSelectedCheckpoint((prevCp) => {
            if (!prevCp) return null;
            return update.checkpoints.find((c) => c.index === prevCp.index) || null;
          });
        } catch (err: unknown) {
          if (!controller.signal.aborted) {
            console.error("Timeline update failed:", extractApiErrorMessage(err));
          }
        } finally {
          if (!controller.signal.aborted && reqId === activeRequestIdRef.current) {
            setIsTimelineLoading(false);
          }
        }
      }, 350);
    },
    [data, selectedRoute]
  );

  return (
    <div className="h-screen w-screen bg-slate-100 flex flex-col font-sans text-slate-800 overflow-hidden">
      {/* Primary Dispatch Console Header */}
      <AppHeader
        isLoading={isLoading}
        onOpenRules={() => setIsRulesOpen(true)}
      />

      {/* Main Operations Workspace: Split Screen Console */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left Dispatch Control Panel (Form + Alternative Comparison) */}
        <aside className="w-full lg:w-[460px] xl:w-[500px] shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col overflow-y-auto p-5 lg:p-6 space-y-6 z-10 shadow-xs">
          {/* Trip & Cargo Planning Form */}
          <RouteSearchForm
            origin={origin}
            setOrigin={setOrigin}
            destination={destination}
            setDestination={setDestination}
            departureTime={departureTime}
            setDepartureTime={setDepartureTime}
            cargoWeightLbs={cargoWeightLbs}
            setCargoWeightLbs={setCargoWeightLbs}
            intervalMiles={intervalMiles}
            setIntervalMiles={setIntervalMiles}
            onSearch={handleSearch}
            isLoading={isLoading}
            isPickingOnMap={isPickingOnMap}
            onTogglePickOnMap={(target) =>
              setIsPickingOnMap((prev) => (prev === target ? null : target))
            }
          />

          {/* Route Alternatives Comparison */}
          {data && (
            <RouteComparison
              routes={data.routes}
              selectedRouteId={selectedRouteId}
              onSelectRoute={(id) => {
                setSelectedRouteId(id);
              }}
              recommendedRouteId={data.recommendation.recommended_route_id}
              allRoutesUnsafe={data.recommendation.all_routes_unsafe}
              departureTime={data.query.departure_time}
            />
          )}
        </aside>

        {/* Right Geographic Analysis Workspace */}
        <main className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-slate-100 min-w-0 p-4 lg:p-5 space-y-3.5">
          {/* Top Banner Area: Error Alert & Dispatch Recommendation */}
          {(errorMessage || (data && data.recommendation)) && (
            <div className="space-y-3 shrink-0 z-10">
              {/* Error Banner */}
              {errorMessage && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl shadow-sm text-red-950 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Evaluation Error</h4>
                      <p className="text-xs text-red-800 mt-1 leading-relaxed">{errorMessage}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-xs text-red-700 hover:text-red-900 font-bold ml-3 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Recommendation / Critical No-Travel Banner */}
              {data && data.recommendation && (
                <RecommendationBanner
                  verdict={data.recommendation}
                  recommendedRoute={recommendedRoute}
                  limitations={data.limitations}
                />
              )}
            </div>
          )}

          {/* Interactive Map & Overlaid Checkpoint Inspector */}
          <div className="flex-1 relative min-h-[300px] lg:min-h-[340px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white shrink-0 sm:shrink">
            <RouteMap
              routes={data ? data.routes : []}
              selectedRouteId={selectedRouteId}
              onSelectRoute={(id) => setSelectedRouteId(id)}
              selectedCheckpoint={selectedCheckpoint}
              onSelectCheckpoint={(cp) => setSelectedCheckpoint(cp)}
              isPickingLocation={isPickingOnMap}
              onMapClickLocation={handleMapClickLocation}
              onCancelPickLocation={() => setIsPickingOnMap(null)}
            />

            {/* Floating Checkpoint Inspector Drawer */}
            <CheckpointInspector
              checkpoint={selectedCheckpoint}
              onClose={() => setSelectedCheckpoint(null)}
              cargoWeightLbs={data?.query.cargo_weight_lbs || 35000}
            />
          </div>

          {/* Bottom Docked 48-Hour Forecast Horizon Control */}
          {data && (
            <div className="shrink-0 z-10 pb-1">
              <ForecastSlider
                offsetHours={timelineOffset}
                onChangeOffset={handleTimelineChange}
                baseDepartureTime={data.query.departure_time}
                isLoading={isTimelineLoading}
              />
            </div>
          )}
        </main>
      </div>

      {/* Safety Rules Reference Modal */}
      <RiskRulesDrawer isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}

export default App;
