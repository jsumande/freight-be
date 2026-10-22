import React, { useState } from "react";
import type { RecommendationVerdict, RouteAlternative } from "../types";
import { ShieldAlert, ShieldCheck, Info, ChevronDown, ChevronUp } from "lucide-react";

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
      <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 shadow-sm text-red-950">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-600 rounded-full text-white mt-0.5">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded">
                CRITICAL DISPATCH ALERT
              </span>
              <h3 className="text-base font-extrabold text-red-900">
                NO ROUTE SATISFIES COMMERCIAL SAFETY CRITERIA
              </h3>
            </div>
            <p className="text-xs text-red-800 mt-1.5 leading-relaxed font-medium">
              {verdict.reasoning}
            </p>
            <div className="mt-2 text-xs text-red-700 bg-red-100/60 p-2 rounded border border-red-200">
              <strong>Operational Directive:</strong> Every viable route alternative contains No-Travel conditions (sustained crosswinds &gt;= 55 mph or severe precipitation exceeding commercial truck stability limits). In accordance with fleet safety protocol, vehicles must hold departure.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!recommendedRoute) return null;

  return (
    <div className="bg-emerald-50 border-2 border-emerald-500 rounded-lg p-4 shadow-sm text-emerald-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-600 rounded-full text-white mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-emerald-700 text-white px-2 py-0.5 rounded">
                DISPATCH RECOMMENDATION
              </span>
              <h3 className="text-base font-extrabold text-emerald-950">
                {recommendedRoute.name}
              </h3>
            </div>

            <p className="text-xs text-emerald-900 mt-1 font-medium leading-relaxed">
              {verdict.reasoning}
            </p>

            {/* Justification Points */}
            <div className="mt-2 flex flex-wrap gap-2">
              {recommendedRoute.recommendation_reasons.map((reason, i) => (
                <span
                  key={i}
                  className="text-[11px] bg-white border border-emerald-300 text-emerald-900 font-semibold px-2 py-0.5 rounded shadow-2xs"
                >
                  ✓ {reason}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-emerald-800 hover:text-emerald-950 flex items-center gap-1 font-semibold p-1 hover:bg-emerald-100 rounded transition-colors"
        >
          <span>Safety Notice</span>
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-emerald-200/80 text-xs text-emerald-900/90 space-y-1.5 bg-emerald-100/40 p-2.5 rounded">
          <div className="font-bold flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Fleet & Routing Limitations:
          </div>
          {limitations.map((lim, idx) => (
            <p key={idx} className="text-[11px] leading-relaxed pl-4 list-disc">
              • {lim}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
