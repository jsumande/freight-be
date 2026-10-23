import React from "react";
import { API_BASE_URL } from "../api";
import {
  Truck,
  Shield,
  Activity,
  Layers,
  FileCode,
  RotateCcw,
} from "lucide-react";

interface AppHeaderProps {
  isLoading: boolean;
  onOpenRules: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isLoading, onOpenRules }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white shrink-0 px-6 py-3.5 shadow-md z-30 select-none">
      <div className="flex items-center justify-between gap-6">
        {/* Brand / Application Identity */}
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-extrabold tracking-tight leading-none text-white">
                WEATHER-AWARE TRUCK ROUTING
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-950 text-blue-400 border border-blue-800/80 px-2 py-0.5 rounded">
                Console v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-none font-medium">
              Commercial Freight Dispatch & Rollover Risk Prevention
            </p>
          </div>
        </div>

        {/* Center Live Calculation Indicator (when active) */}
        {isLoading && (
          <div className="hidden md:flex items-center gap-2.5 bg-blue-950/80 border border-blue-700/60 text-blue-300 px-4 py-1.5 rounded-full text-xs font-semibold animate-pulse shadow-sm">
            <RotateCcw className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
            <span>Evaluating route alternatives & weather hazards...</span>
          </div>
        )}

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Service Status Badges */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-800/80 px-3 h-9 rounded-md border border-slate-700/60">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300 text-xs">OSRM Engine:</span>
            <span className="font-semibold text-white text-xs">Live</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-slate-800/80 px-3 h-9 rounded-md border border-slate-700/60">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 text-xs">Open-Meteo:</span>
            <span className="font-semibold text-white text-xs">Live</span>
          </div>

          {/* Swagger API Docs Link */}
          <a
            href={`${API_BASE_URL}/api/docs/`}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold px-3 h-9 rounded-md border border-slate-700 transition-colors"
            title="Open OpenAPI 3.0 / Swagger UI"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs">API Docs</span>
          </a>

          {/* Safety Rules Reference */}
          <button
            onClick={onOpenRules}
            type="button"
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold px-3 h-9 rounded-md border border-slate-700 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs">Safety Rules</span>
          </button>
        </div>
      </div>
    </header>
  );
};
