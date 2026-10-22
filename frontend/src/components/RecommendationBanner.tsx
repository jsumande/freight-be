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
    <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-5 shadow-sm text-emerald-950">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-emerald-600 rounded-xl text-white mt-0.5 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider bg-emerald-700 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                DISPATCH RECOMMENDATION
              </span>
              <h3 className="text-base font-extrabold text-emerald-950 tracking-tight">
                {recommendedRoute.name}
              </h3>
            </div>

            <p className="text-xs text-emerald-900 font-medium leading-relaxed">
              {verdict.reasoning}
            </p>

            {/* Justification Points */}
            <div className="pt-1 flex flex-wrap gap-2">
              {recommendedRoute.recommendation_reasons.map((reason, i) => (
                <span
                  key={i}
                  className="text-xs bg-white border border-emerald-300 text-emerald-900 font-semibold px-2.5 py-1 rounded-md shadow-2xs"
                >
                  ✓ {reason}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 font-semibold px-2.5 py-1.5 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <span>Safety Notice</span>
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {showDetails && (
        <div className="mt-4 pt-3.5 border-t border-emerald-200/80 text-xs text-emerald-900/90 space-y-2 bg-emerald-100/50 p-3.5 rounded-lg">
          <div className="font-bold flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-700" /> Fleet & Routing Limitations:
          </div>
          {limitations.map((lim, idx) => (
            <p key={idx} className="text-xs leading-relaxed pl-4 list-disc">
              • {lim}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
