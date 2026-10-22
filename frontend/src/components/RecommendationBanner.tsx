import React, { useState } from "react";
import type { RecommendationVerdict, RouteAlternative } from "../types";
import {
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
} from "lucide-react";

interface RecommendationBannerProps {
  verdict: RecommendationVerdict;
  recommendedRoute: RouteAlternative | null;
  limitations: string[];
}

export const RecommendationBanner: React.FC<RecommendationBannerProps> = ({
  verdict,
  recommendedRoute,
  limitations,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Critical State: All routes contain unsafe No-Travel conditions
  if (verdict.all_routes_unsafe) {
    return (
      <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 sm:p-5 shadow-sm text-red-950">
        <div className="flex items-start gap-3.5 sm:gap-4">
          <div className="p-2.5 bg-red-600 rounded-xl text-white mt-0.5 shadow-xs shrink-0">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                CRITICAL DISPATCH ALERT
              </span>
              <span className="text-xs font-semibold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-md">
                Safety Hold Advised
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-extrabold text-red-900 tracking-tight">
              NO ROUTE SATISFIES COMMERCIAL SAFETY CRITERIA
            </h3>

            <p className="text-xs text-red-800 leading-relaxed font-medium">
              {verdict.reasoning}
            </p>

            <div className="text-xs text-red-800 bg-red-100/70 p-3 rounded-lg border border-red-200 leading-relaxed space-y-1">
              <div className="font-bold text-red-900 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 text-red-700" />
                <span>Recommended Action for Drivers & Dispatchers:</span>
              </div>
              <p className="text-[11px] sm:text-xs text-red-800">
                All viable highway routes currently exceed safe operating thresholds for commercial trucks
                (sustained crosswinds &ge; 55 mph or severe snow/ice). To protect drivers and prevent cargo
                rollovers, hold departure or check the timeline slider below for safer departure windows.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!recommendedRoute) return null;

  // Clean inline explanation by stripping redundant route name prefix if present
  let cleanReason = verdict.reasoning;
  if (cleanReason.startsWith(`${recommendedRoute.name} is recommended:`)) {
    cleanReason = cleanReason.replace(`${recommendedRoute.name} is recommended:`, "").trim();
  }

  return (
    <div className="bg-emerald-50/95 border border-emerald-300 rounded-xl px-4 py-2.5 shadow-2xs text-emerald-950 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Badge + Route Name + Friendly Summary */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-4 h-4" />
          </div>

          <span className="text-[11px] font-extrabold uppercase tracking-wider bg-emerald-200/90 text-emerald-900 px-2.5 py-0.5 rounded-full shrink-0 border border-emerald-300/70 shadow-2xs">
            Recommended Route
          </span>

          <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
            {recommendedRoute.name}
          </span>

          <span className="hidden lg:inline text-xs text-slate-600 truncate max-w-md">
            — {cleanReason}
          </span>
        </div>

        {/* Right: Quick Highlight Pill + "Why this route?" toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {recommendedRoute.recommendation_reasons.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-white border border-emerald-200 px-2.5 py-0.5 rounded-full shadow-2xs">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{recommendedRoute.recommendation_reasons[0]}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100/80 hover:bg-emerald-200/80 transition-colors cursor-pointer border border-emerald-300/60"
            aria-expanded={showDetails}
          >
            <span>{showDetails ? "Hide Details" : "Why this route?"}</span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Accordion: Friendly Reasons & Dispatch Insights */}
      {showDetails && (
        <div className="w-full mt-2.5 pt-2.5 border-t border-emerald-200 text-xs text-emerald-950 space-y-2.5 animate-in fade-in duration-150">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Dispatch Selection Rationale:
            </span>
            <p className="text-xs font-medium text-slate-800 mt-0.5 leading-relaxed">
              {verdict.reasoning}
            </p>
          </div>

          {/* Friendly Benefit Tags */}
          {recommendedRoute.recommendation_reasons.length > 0 && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Safety & Performance Advantages:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {recommendedRoute.recommendation_reasons.map((reason, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-emerald-300 text-emerald-900 font-semibold px-2.5 py-1 rounded-md shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{reason}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Operational Notes / Limitations */}
          {limitations.length > 0 && (
            <div className="text-[11px] text-slate-500 pt-2 border-t border-emerald-200/60 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-600 font-semibold">Route Advisories:</strong>{" "}
                {limitations.join(" • ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
