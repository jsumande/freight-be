import React from "react";
import { BookOpen, X, Shield, AlertTriangle } from "lucide-react";

interface RiskRulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RiskRulesDrawer: React.FC<RiskRulesDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base">Weather Hazard & Cargo-Weight Safety Rules</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-xs text-slate-700">
          <div>
            <h4 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-600" /> Exact Hazard Classification Boundaries
            </h4>
            <p className="text-slate-500 mb-2">
              Every checkpoint evaluates three simultaneous weather hazards against strict mathematical thresholds.
            </p>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2">Risk Level</th>
                    <th className="p-2">Wind Speed (mph)</th>
                    <th className="p-2">Rainfall (in/hr)</th>
                    <th className="p-2">Snowfall (in/hr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  <tr className="bg-emerald-50/50">
                    <td className="p-2 font-bold text-emerald-800">LOW</td>
                    <td className="p-2">&lt; 25.0</td>
                    <td className="p-2">&lt; 0.10</td>
                    <td className="p-2">&lt; 0.50</td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="p-2 font-bold text-amber-800">MODERATE</td>
                    <td className="p-2">25.0 – 34.9</td>
                    <td className="p-2">0.10 – 0.249</td>
                    <td className="p-2">0.50 – 0.99</td>
                  </tr>
                  <tr className="bg-orange-50/50">
                    <td className="p-2 font-bold text-orange-800">HIGH</td>
                    <td className="p-2">35.0 – 44.9</td>
                    <td className="p-2">0.25 – 0.499</td>
                    <td className="p-2">1.00 – 1.99</td>
                  </tr>
                  <tr className="bg-red-50/50">
                    <td className="p-2 font-bold text-red-800">SEVERE</td>
                    <td className="p-2">45.0 – 54.9</td>
                    <td className="p-2">0.50 – 1.00 (inclusive)</td>
                    <td className="p-2">2.00 – 3.00 (inclusive)</td>
                  </tr>
                  <tr className="bg-red-100/70 font-bold">
                    <td className="p-2 text-red-950">NO TRAVEL</td>
                    <td className="p-2">&ge; 55.0</td>
                    <td className="p-2">&gt; 1.00</td>
                    <td className="p-2">&gt; 3.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Cargo-Weight Dynamic Overrides
            </h4>
            <p className="text-slate-500 mb-2">
              Vehicle stability diminishes significantly in crosswinds depending on gross vehicle load.
            </p>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>
                <strong>Universal Stop:</strong> Wind speed &ge; 55 mph results in <strong>No Travel</strong> regardless of cargo weight.
              </li>
              <li>
                <strong>Over 30,000 lbs:</strong> Wind speed in [45.0, 55.0) mph escalates to <strong>No Travel</strong> if cargo weight &gt; 30,000 lbs.
              </li>
              <li>
                <strong>Over 40,000 lbs:</strong> Wind speed in [35.0, 45.0) mph escalates to <strong>Severe</strong> if cargo weight &gt; 40,000 lbs.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-slate-900 mb-1">Lexicographical Route Ranking Rules</h4>
            <ol className="space-y-1 list-decimal pl-5">
              <li>Fewest miles classified as <strong>Severe</strong>.</li>
              <li>Fewest miles classified as <strong>High</strong>.</li>
              <li>Lowest distance-weighted <strong>Average Risk Score</strong> (Low=1.0, Moderate=2.0, High=3.0, Severe=4.0, No Travel=5.0).</li>
              <li>Shortest estimated travel time.</li>
            </ol>
            <p className="mt-2 text-slate-500 italic">
              Mileage is attributed using 1D Voronoi segment midpoints, ensuring exact distance conservation without sampling distortion.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white font-semibold rounded text-xs hover:bg-slate-900"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
