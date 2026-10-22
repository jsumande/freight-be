import React from "react";
import type { RouteAlternative } from "../types";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  Navigation,
  Wind,
  CloudRain,
  Snowflake,
  Sun,
  Flame,
  AlertTriangle,
  Gauge,
  Sparkles,
  Eye,
  Check,
} from "lucide-react";

interface RouteComparisonProps {
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  recommendedRouteId: string | null;
  allRoutesUnsafe: boolean;
  departureTime?: string;
}

const ROUTE_THEMES = [
  {
    name: "Blue Corridor",
    color: "#2563eb",
    borderActive: "border-blue-600",
    bgActive: "bg-blue-50/40",
    badgeBg: "bg-blue-600",
    textAccent: "text-blue-700",
    swatch: "bg-blue-600",
    ring: "ring-2 ring-blue-500/20",
    barColor: "bg-blue-600",
  },
  {
    name: "Purple Corridor",
    color: "#8b5cf6",
    borderActive: "border-purple-600",
    bgActive: "bg-purple-50/40",
    badgeBg: "bg-purple-600",
    textAccent: "text-purple-700",
    swatch: "bg-purple-600",
    ring: "ring-2 ring-purple-500/20",
    barColor: "bg-purple-600",
  },
  {
    name: "Teal Corridor",
    color: "#0d9488",
    borderActive: "border-teal-600",
    bgActive: "bg-teal-50/40",
    badgeBg: "bg-teal-600",
    textAccent: "text-teal-700",
    swatch: "bg-teal-600",
    ring: "ring-2 ring-teal-500/20",
    barColor: "bg-teal-600",
  },
];

export const RouteComparison: React.FC<RouteComparisonProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  recommendedRouteId,
  allRoutesUnsafe,
  departureTime,
}) => {
  if (!routes || routes.length === 0) return null;

  const baseDepTime = departureTime ? new Date(departureTime).getTime() : Date.now();
  const baselineRoute = routes[0];

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center text-blue-700">
            <Navigation className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Route Alternatives ({routes.length})
            </h3>
            <p className="text-[10px] text-slate-500">Ranked by lexicographical safety rules</p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
          Priorities 1–4
        </span>
      </div>

      {/* Route Cards */}
      <div className="space-y-3.5">
        {routes.map((route, idx) => {
          const isSelected = route.id === selectedRouteId;
          const isRecommended = route.id === recommendedRouteId;
          const theme = ROUTE_THEMES[idx % ROUTE_THEMES.length];
          const isSafe = route.metrics.is_safe;

          // Compute ETA
          const etaDate = new Date(baseDepTime + route.duration_seconds * 1000);
          const formattedEta = isNaN(etaDate.getTime())
            ? "--:--"
            : etaDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });

          // Checkpoint weather highlights
          const checkpoints = route.checkpoints || [];
          let maxWind = 0;
          let maxRain = 0;
          let maxSnow = 0;

          for (const cp of checkpoints) {
            if (cp.weather) {
              if (cp.weather.wind_speed_mph && cp.weather.wind_speed_mph > maxWind) {
                maxWind = cp.weather.wind_speed_mph;
              }
              if (cp.weather.rainfall_in_hr && cp.weather.rainfall_in_hr > maxRain) {
                maxRain = cp.weather.rainfall_in_hr;
              }
              if (cp.weather.snowfall_in_hr && cp.weather.snowfall_in_hr > maxSnow) {
                maxSnow = cp.weather.snowfall_in_hr;
              }
            }
          }

          // Risk breakdown percentage calculation
          const totalDist = route.distance_miles > 0 ? route.distance_miles : 1;
          const severePct = Math.min(100, Math.round((route.metrics.severe_risk_miles / totalDist) * 100));
          const highPct = Math.min(100, Math.round((route.metrics.high_risk_miles / totalDist) * 100));
          const modPct = Math.min(100, Math.round((route.metrics.moderate_risk_miles / totalDist) * 100));
          const noTravelPct = Math.min(100, Math.round(((route.metrics.no_travel_miles || 0) / totalDist) * 100));
          const lowPct = Math.max(0, 100 - (severePct + highPct + modPct + noTravelPct));

          // Time/Distance delta vs Rank 1
          const distDelta = route.distance_miles - baselineRoute.distance_miles;
          const timeDeltaMinutes = Math.round((route.duration_seconds - baselineRoute.duration_seconds) / 60);

          return (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className={`group relative cursor-pointer rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                isSelected
                  ? `${theme.borderActive} ${theme.bgActive} ${theme.ring} shadow-md`
                  : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              {/* Left Color Swatch Strip */}
              <div
                className="absolute top-0 bottom-0 left-0 w-1.5 transition-colors"
                style={{ backgroundColor: theme.color }}
              />

              <div className="p-4 pl-5 space-y-3">
                {/* Header: Rank + Map Palette Dot + Recommendation/Safety Badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono border border-slate-200/60">
                      <span className={`w-2 h-2 rounded-full ${theme.swatch}`} />
                      Rank #{route.rank}
                    </span>

                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                        <Eye className="w-3 h-3" />
                        Active on Map
                      </span>
                    )}
                  </div>

                  {isRecommended && !allRoutesUnsafe ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-full shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      RECOMMENDED
                    </span>
                  ) : !isSafe ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-800 bg-red-100/90 border border-red-300 px-2.5 py-1 rounded-full shadow-2xs">
                      <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      DISQUALIFIED
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      Alternative
                    </span>
                  )}
                </div>

                {/* Route Title & Summary */}
                <div>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-900 transition-colors leading-snug">
                    {route.name}
                  </h4>
                  {route.summary && route.summary !== route.name && (
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{route.summary}</p>
                  )}
                </div>

                {/* Core Navigation Metrics (Distance, Time, ETA, Deltas) */}
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1 font-mono gap-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">
                      <span>{route.distance_miles.toFixed(1)} miles</span>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-700 font-semibold">{route.duration_formatted}</span>
                    {idx > 0 && distDelta !== 0 && (
                      <span className="text-[11px] text-slate-400 font-sans">
                        ({distDelta > 0 ? `+${distDelta.toFixed(1)}` : distDelta.toFixed(1)} mi)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>ETA {formattedEta}</span>
                    {idx > 0 && timeDeltaMinutes !== 0 && (
                      <span className="text-[10px] text-slate-400 font-sans">
                        ({timeDeltaMinutes > 0 ? `+${timeDeltaMinutes}m` : `${timeDeltaMinutes}m`})
                      </span>
                    )}
                  </div>
                </div>

                {/* Visual Risk Exposure Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <span>Risk Profile</span>
                      <span className="text-slate-400">({lowPct}% Low Risk)</span>
                    </span>
                    <span className="font-mono">
                      {route.metrics.severe_risk_miles > 0 ? (
                        <span className="text-red-600 font-bold">{route.metrics.severe_risk_miles.toFixed(1)} mi severe</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">Zero severe hazards</span>
                      )}
                    </span>
                  </div>

                  {/* Segmented bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                    {noTravelPct > 0 && (
                      <div
                        style={{ width: `${noTravelPct}%` }}
                        className="bg-black shrink-0 transition-all"
                        title={`No Travel: ${noTravelPct}%`}
                      />
                    )}
                    {severePct > 0 && (
                      <div
                        style={{ width: `${severePct}%` }}
                        className="bg-red-500 shrink-0 transition-all"
                        title={`Severe Risk: ${severePct}%`}
                      />
                    )}
                    {highPct > 0 && (
                      <div
                        style={{ width: `${highPct}%` }}
                        className="bg-amber-500 shrink-0 transition-all"
                        title={`High Risk: ${highPct}%`}
                      />
                    )}
                    {modPct > 0 && (
                      <div
                        style={{ width: `${modPct}%` }}
                        className="bg-yellow-400 shrink-0 transition-all"
                        title={`Moderate Risk: ${modPct}%`}
                      />
                    )}
                    {lowPct > 0 && (
                      <div
                        style={{ width: `${lowPct}%` }}
                        className="bg-emerald-500 shrink-0 transition-all"
                        title={`Low Risk: ${lowPct}%`}
                      />
                    )}
                  </div>
                </div>

                {/* Key Priority Safety Metrics (Cards) */}
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  {/* Metric 1: Severe Risk Miles */}
                  <div
                    className={`p-2 rounded-lg text-center border transition-colors ${
                      route.metrics.severe_risk_miles > 0
                        ? "bg-red-50/80 border-red-200 text-red-900"
                        : "bg-emerald-50/50 border-emerald-100 text-emerald-900"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-tight text-slate-500 font-sans">
                      <Flame className="w-3 h-3 text-red-500 shrink-0" />
                      <span>1. Severe</span>
                    </div>
                    <div
                      className={`font-bold text-sm mt-0.5 ${
                        route.metrics.severe_risk_miles > 0 ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {route.metrics.severe_risk_miles.toFixed(1)} mi
                    </div>
                  </div>

                  {/* Metric 2: High Risk Miles */}
                  <div
                    className={`p-2 rounded-lg text-center border transition-colors ${
                      route.metrics.high_risk_miles > 0
                        ? "bg-amber-50/80 border-amber-200 text-amber-900"
                        : "bg-slate-50 border-slate-200/60 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-tight text-slate-500 font-sans">
                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>2. High</span>
                    </div>
                    <div
                      className={`font-bold text-sm mt-0.5 ${
                        route.metrics.high_risk_miles > 0 ? "text-amber-600" : "text-slate-700"
                      }`}
                    >
                      {route.metrics.high_risk_miles.toFixed(1)} mi
                    </div>
                  </div>

                  {/* Metric 3: Average Hazard Score */}
                  <div className="p-2 rounded-lg text-center border bg-slate-50 border-slate-200/60 text-slate-800">
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-tight text-slate-500 font-sans">
                      <Gauge className="w-3 h-3 text-blue-500 shrink-0" />
                      <span>3. Avg Score</span>
                    </div>
                    <div
                      className={`font-bold text-sm mt-0.5 ${
                        route.metrics.average_risk_score >= 2.5
                          ? "text-red-600"
                          : route.metrics.average_risk_score >= 1.5
                          ? "text-amber-600"
                          : "text-slate-800"
                      }`}
                    >
                      {route.metrics.average_risk_score.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Weather Highlights Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                  {maxWind > 0 && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium ${
                        maxWind >= 45
                          ? "bg-red-50 text-red-700 border-red-200"
                          : maxWind >= 25
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      <Wind className="w-3 h-3" />
                      <span>Max Wind {Math.round(maxWind)} mph</span>
                    </span>
                  )}

                  {maxSnow > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                      <Snowflake className="w-3 h-3 text-indigo-500" />
                      <span>Snow {maxSnow.toFixed(2)} in/hr</span>
                    </span>
                  )}

                  {maxRain > 0 && maxSnow <= 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                      <CloudRain className="w-3 h-3 text-blue-500" />
                      <span>Rain {maxRain.toFixed(2)} in/hr</span>
                    </span>
                  )}

                  {maxWind < 25 && maxSnow <= 0 && maxRain <= 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                      <Sun className="w-3 h-3 text-emerald-500" />
                      <span>Mild / Dry Conditions</span>
                    </span>
                  )}
                </div>

                {/* Recommendation Reason Callout */}
                {route.recommendation_reasons && route.recommendation_reasons.length > 0 && (
                  <div className="bg-slate-50/90 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-600 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">
                      {route.recommendation_reasons[0]}
                    </span>
                  </div>
                )}

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold transition-colors flex items-center gap-1.5 ${
                      isSelected ? theme.textAccent : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Active on Map</span>
                      </>
                    ) : (
                      <span>Click to view route on map</span>
                    )}
                  </span>
                  <ArrowRight
                    className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${
                      isSelected ? theme.textAccent : "text-slate-300 group-hover:text-slate-500"
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
