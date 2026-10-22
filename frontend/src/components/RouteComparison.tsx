import React from "react";
import type { RouteAlternative } from "../types";
import { CheckCircle2, XCircle, ArrowRight, Clock, Navigation } from "lucide-react";

interface RouteComparisonProps {
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  recommendedRouteId: string | null;
  allRoutesUnsafe: boolean;
  departureTime?: string;
}

const ROUTE_ACCENTS = [
  { border: "border-blue-600", activeBg: "bg-blue-50/40", badge: "bg-blue-600", text: "text-blue-700" },
  { border: "border-purple-600", activeBg: "bg-purple-50/40", badge: "bg-purple-600", text: "text-purple-700" },
  { border: "border-teal-600", activeBg: "bg-teal-50/40", badge: "bg-teal-600", text: "text-teal-700" },
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

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-blue-600" />
          <span>Route Alternatives ({routes.length})</span>
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Ranked by Priorities 1–4</span>
      </div>

      <div className="space-y-2">
        {routes.map((route, idx) => {
          const isSelected = route.id === selectedRouteId;
          const isRecommended = route.id === recommendedRouteId;
          const accent = ROUTE_ACCENTS[idx % ROUTE_ACCENTS.length];
          const isSafe = route.metrics.is_safe;

          const etaDate = new Date(baseDepTime + route.duration_seconds * 1000);
          const formattedEta = etaDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className={`relative cursor-pointer rounded-lg border-2 p-3 transition-all ${
                isSelected
                  ? `${accent.border} ${accent.activeBg} ring-2 ring-blue-100 shadow-sm`
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              {/* Header: Rank + Safety Badge */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                  Rank #{route.rank}
                </span>

                {isRecommended && !allRoutesUnsafe ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    RECOMMENDED
                  </span>
                ) : !isSafe ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3 h-3 text-red-600 shrink-0" />
                    DISQUALIFIED
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                    Alternative
                  </span>
                )}
              </div>

              {/* Route Title & Transit Duration */}
              <div className="font-bold text-xs text-slate-900 truncate" title={route.name}>
                {route.name}
              </div>

              <div className="text-[11px] text-slate-600 flex items-center justify-between mt-1 font-mono">
                <span>
                  <span>{route.distance_miles.toFixed(1)} miles</span>
                  {" • "}
                  <span>{route.duration_formatted}</span>
                </span>
                <span className="flex items-center gap-1 text-slate-500 text-[10px]">
                  <Clock className="w-3 h-3" /> ETA {formattedEta}
                </span>
              </div>

              {/* Priority Metric Badges */}
              <div className="grid grid-cols-3 gap-1 text-[10px] border-t border-slate-100 pt-2 mt-2 font-mono">
                <div className="bg-slate-50 p-1 rounded text-center">
                  <div className="text-[9px] text-slate-400 font-sans">1. Severe</div>
                  <div className={`font-bold ${route.metrics.severe_risk_miles > 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {route.metrics.severe_risk_miles.toFixed(1)} mi
                  </div>
                </div>

                <div className="bg-slate-50 p-1 rounded text-center">
                  <div className="text-[9px] text-slate-400 font-sans">2. High</div>
                  <div className={`font-bold ${route.metrics.high_risk_miles > 0 ? "text-amber-600" : "text-slate-700"}`}>
                    {route.metrics.high_risk_miles.toFixed(1)} mi
                  </div>
                </div>

                <div className="bg-slate-50 p-1 rounded text-center">
                  <div className="text-[9px] text-slate-400 font-sans">3. Avg Score</div>
                  <div className="font-bold text-slate-800">
                    {route.metrics.average_risk_score.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Active Selection / Click Callout */}
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className={`font-semibold ${isSelected ? "text-blue-600" : "text-slate-400"}`}>
                  {isSelected ? "● Displayed on Map" : "Click to View on Map"}
                </span>
                <ArrowRight className={`w-3 h-3 ${isSelected ? "text-blue-600" : "text-slate-300"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
