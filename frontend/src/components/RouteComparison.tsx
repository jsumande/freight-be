import React from "react";
import type { RouteAlternative } from "../types";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

interface RouteComparisonProps {
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  recommendedRouteId: string | null;
  allRoutesUnsafe: boolean;
}

const ROUTE_ACCENTS = [
  { border: "border-blue-500", bg: "bg-blue-50", badge: "bg-blue-600", text: "text-blue-700" },
  { border: "border-purple-500", bg: "bg-purple-50", badge: "bg-purple-600", text: "text-purple-700" },
  { border: "border-teal-500", bg: "bg-teal-50", badge: "bg-teal-600", text: "text-teal-700" },
];

export const RouteComparison: React.FC<RouteComparisonProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  recommendedRouteId,
  allRoutesUnsafe,
}) => {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Route Alternatives Comparison ({routes.length})
        </h3>
        <span className="text-xs text-slate-500">Sorted by Safety Priorities</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {routes.map((route, idx) => {
          const isSelected = route.id === selectedRouteId;
          const isRecommended = route.id === recommendedRouteId;
          const accent = ROUTE_ACCENTS[idx % ROUTE_ACCENTS.length];
          const isSafe = route.metrics.is_safe;

          return (
            <div
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className={`relative cursor-pointer rounded-lg border-2 p-3.5 transition-all shadow-sm ${
                isSelected
                  ? `${accent.border} bg-white ring-2 ring-blue-100 shadow-md`
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow"
              }`}
            >
              {/* Top Row: Rank & Recommendation badge */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  Rank #{route.rank}
                </span>

                {isRecommended && !allRoutesUnsafe ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    RECOMMENDED
                  </span>
                ) : !isSafe ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    DISQUALIFIED
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                    Alternative
                  </span>
                )}
              </div>

              {/* Route Name & Summary */}
              <div className="font-bold text-sm text-slate-900 truncate mb-1" title={route.name}>
                {route.name}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mb-3">
                <span className="font-semibold text-slate-800">{route.distance_miles.toFixed(1)} miles</span>
                <span>•</span>
                <span className="font-semibold text-slate-800">{route.duration_formatted}</span>
              </div>

              {/* Priority Metric Breakdown */}
              <div className="space-y-1.5 text-xs border-t border-slate-100 pt-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">1. Severe Miles:</span>
                  <span className={`font-mono font-bold ${route.metrics.severe_risk_miles > 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {route.metrics.severe_risk_miles.toFixed(1)} mi
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">2. High-Risk Miles:</span>
                  <span className={`font-mono font-bold ${route.metrics.high_risk_miles > 0 ? "text-amber-600" : "text-slate-700"}`}>
                    {route.metrics.high_risk_miles.toFixed(1)} mi
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">3. Average Risk Score:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {route.metrics.average_risk_score.toFixed(2)} / 5.0
                  </span>
                </div>
                {route.metrics.no_travel_miles > 0 && (
                  <div className="flex justify-between items-center bg-red-50 p-1 rounded text-red-900 font-bold">
                    <span>No Travel Exposure:</span>
                    <span>{route.metrics.no_travel_miles.toFixed(1)} mi</span>
                  </div>
                )}
              </div>

              {/* Selection Indicator */}
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className={`font-semibold ${isSelected ? "text-blue-600" : "text-slate-400"}`}>
                  {isSelected ? "Active on Map" : "Click to View on Map"}
                </span>
                <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? "text-blue-600" : "text-slate-400"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
