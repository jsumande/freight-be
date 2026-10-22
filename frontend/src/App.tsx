import { useState, useEffect, useRef, useCallback } from "react";
import type {
  RouteCalculationResponse,
  RouteCheckpoint,
} from "./types";
import {
  fetchRouteEvaluation,
  fetchTimelineUpdate,
} from "./api";
import type { CalculateRouteParams } from "./api";
import { RouteMap } from "./components/RouteMap";
import { RouteSearchForm } from "./components/RouteSearchForm";
import { RouteComparison } from "./components/RouteComparison";
import { RecommendationBanner } from "./components/RecommendationBanner";
import { CheckpointInspector } from "./components/CheckpointInspector";
import { ForecastSlider } from "./components/ForecastSlider";
import { RiskRulesDrawer } from "./components/RiskRulesDrawer";
import {
  Truck,
  Shield,
  AlertCircle,
  Activity,
  Layers,
  FileCode,
} from "lucide-react";

export function App() {
  const [data, setData] = useState<RouteCalculationResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<RouteCheckpoint | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Timeline slider state (0 to 48 hours)
  const [timelineOffset, setTimelineOffset] = useState<number>(0);
  const [isTimelineLoading, setIsTimelineLoading] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  const handleSearch = async (params: CalculateRouteParams) => {
    setIsLoading(true);
    setErrorMessage(null);
    setTimelineOffset(0);
    setSelectedCheckpoint(null);

    try {
      const response = await fetchRouteEvaluation(params);
      setData(response);
      if (response.routes.length > 0) {
        const topRoute = response.recommendation.recommended_route_id || response.routes[0].id;
        setSelectedRouteId(topRoute);
        const active = response.routes.find((r) => r.id === topRoute) || response.routes[0];
        if (active && active.checkpoints.length > 0) {
          setSelectedCheckpoint(active.checkpoints[0]);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to calculate routes and weather risks.");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial calculation on mount
  useEffect(() => {
    handleSearch({
      origin: "Chicago, IL",
      destination: "Milwaukee, WI",
      departure_time: new Date().toISOString(),
      cargo_weight_lbs: 35000,
      checkpoint_interval_miles: 25,
    });
  }, []);

  // Re-evaluates current route checkpoints when slider changes
  const handleTimelineChange = useCallback(
    (offsetHours: number) => {
      setTimelineOffset(offsetHours);

      if (!data || !selectedRouteId) return;

      const currentRoute = data.routes.find((r) => r.id === selectedRouteId);
      if (!currentRoute || currentRoute.checkpoints.length === 0) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setIsTimelineLoading(true);
      const reqId = ++activeRequestIdRef.current;

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const update = await fetchTimelineUpdate({
            offset_hours: offsetHours,
            cargo_weight_lbs: data.query.cargo_weight_lbs,
            total_distance_miles: currentRoute.distance_miles,
            checkpoints: currentRoute.checkpoints,
          });

          // Discard stale responses
          if (reqId !== activeRequestIdRef.current) return;

          // Update route metrics and checkpoints in local state
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

          // Update inspected checkpoint if one was selected
          setSelectedCheckpoint((prevCp) => {
            if (!prevCp) return null;
            return update.checkpoints.find((c) => c.index === prevCp.index) || null;
          });
        } catch (err: any) {
          console.error("Timeline update failed:", err);
        } finally {
          if (reqId === activeRequestIdRef.current) {
            setIsTimelineLoading(false);
          }
        }
      }, 350);
    },
    [data, selectedRouteId]
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg shadow">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight">Weather-Aware Truck Dispatch</h1>
              <p className="text-[11px] text-slate-400 font-medium">
                High-Profile Commercial Rollover & Weather Hazard Routing Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">OSRM Engine:</span>
              <span className="font-semibold text-white">Live</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300">Open-Meteo:</span>
              <span className="font-semibold text-white">Live Hourly</span>
            </div>

            <a
              href="http://127.0.0.1:4040/api/docs/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold px-2.5 py-1 rounded-md border border-slate-700 transition-colors cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>Swagger API</span>
            </a>

            <button
              onClick={() => setIsRulesOpen(true)}
              className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-2.5 py-1 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Safety Rules</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto w-full p-4 flex-1 space-y-4">
        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm text-red-900 flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Evaluation Error</h4>
                <p className="text-xs text-red-800 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-red-700 hover:text-red-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Input Parameters & Recommendation Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 space-y-4">
            <RouteSearchForm onSearch={handleSearch} isLoading={isLoading} />
          </div>

          <div className="lg:col-span-7 space-y-4">
            {data && data.recommendation && (
              <RecommendationBanner
                verdict={data.recommendation}
                recommendedRoute={data.routes.find((r) => r.id === data.recommendation.recommended_route_id) || data.routes[0]}
                limitations={data.limitations}
              />
            )}

            {data && (
              <ForecastSlider
                offsetHours={timelineOffset}
                onChangeOffset={handleTimelineChange}
                baseDepartureTime={data.query.departure_time}
                isLoading={isTimelineLoading}
              />
            )}
          </div>
        </div>

        {/* Route Comparison Cards */}
        {data && (
          <RouteComparison
            routes={data.routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(id) => {
              setSelectedRouteId(id);
              const route = data.routes.find((r) => r.id === id);
              if (route && route.checkpoints.length > 0) {
                setSelectedCheckpoint(route.checkpoints[0]);
              }
            }}
            recommendedRouteId={data.recommendation.recommended_route_id}
            allRoutesUnsafe={data.recommendation.all_routes_unsafe}
          />
        )}

        {/* Map & Checkpoint Inspector Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Map Area */}
          <div className="lg:col-span-8 h-[540px]">
            <RouteMap
              routes={data ? data.routes : []}
              selectedRouteId={selectedRouteId}
              onSelectRoute={(id) => setSelectedRouteId(id)}
              selectedCheckpoint={selectedCheckpoint}
              onSelectCheckpoint={(cp) => setSelectedCheckpoint(cp)}
            />
          </div>

          {/* Checkpoint Detail Inspector */}
          <div className="lg:col-span-4 h-[540px]">
            <CheckpointInspector
              checkpoint={selectedCheckpoint}
              onClose={() => setSelectedCheckpoint(null)}
              cargoWeightLbs={data?.query.cargo_weight_lbs || 35000}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-xs py-4 px-4 text-center mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Weather-Aware Commercial Truck Routing Engine • Deterministic Risk Model</span>
          <span className="text-[11px] text-slate-500">
            Powered by OSRM Highway Polylines & Open-Meteo High-Resolution Forecasting
          </span>
        </div>
      </footer>

      {/* Safety Rules Reference Modal */}
      <RiskRulesDrawer isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}
export default App;
