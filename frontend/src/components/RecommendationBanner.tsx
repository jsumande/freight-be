import React, { useState } from "react";
import type { RecommendationVerdict, RouteAlternative } from "../types";
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

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

  if (verdict.all_routes_unsafe) {
    return (
      <div className="bg-red-50 border-2 border-red-500 rounded-xl p-5 shadow-sm text-red-950">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-red-600 rounded-xl text-white mt-0.5 shadow-xs">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                CRITICAL DISPATCH ALERT
              </span>
              <h3 className="text-base font-extrabold text-red-900 tracking-tight">
                NO ROUTE SATISFIES COMMERCIAL SAFETY CRITERIA
              </h3>
            </div>
            <p className="text-xs text-red-800 leading-relaxed font-medium">
              {verdict.reasoning}
            </p>
            <div className="text-xs text-red-700 bg-red-100/70 p-3 rounded-lg border border-red-200 leading-relaxed">
              <strong>Operational Directive:</strong> Every viable route alternative contains No-Travel conditions (sustained crosswinds &ge; 55 mph or severe precipitation exceeding commercial truck stability limits). In accordance with fleet safety protocol, vehicles must hold departure.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!recommendedRoute) return null;

  return (
    <div className="bg-emerald-50/90 border border-emerald-300 rounded-lg px-3.5 py-2 shadow-2xs text-emerald-950 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded shrink-0">
          Recommended
        </span>
        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
          {recommendedRoute.name}
        </span>
        <span className="hidden md:inline text-xs text-slate-600 truncate">
          — {verdict.reasoning}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {recommendedRoute.recommendation_reasons.length > 0 && (
          <span className="text-[11px] font-semibold text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded shadow-2xs">
            ✓ {recommendedRoute.recommendation_reasons[0]}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 cursor-pointer hover:underline ml-1"
        >
          <span>{showDetails ? "Hide" : "Details"}</span>
          {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showDetails && (
        <div className="w-full basis-full mt-1.5 pt-2 border-t border-emerald-200/80 text-xs text-emerald-950 space-y-1.5 animate-in fade-in duration-150">
          <p className="text-xs font-medium text-emerald-900">{verdict.reasoning}</p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {recommendedRoute.recommendation_reasons.map((reason, i) => (
              <span
                key={i}
                className="text-[11px] bg-white border border-emerald-300 text-emerald-900 font-semibold px-2 py-0.5 rounded shadow-2xs"
              >
                ✓ {reason}
              </span>
            ))}
          </div>
          {limitations.length > 0 && (
            <div className="text-[10px] text-slate-500 pt-1 border-t border-emerald-200/40">
              <strong>Routing Notice:</strong> {limitations.join(" • ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
