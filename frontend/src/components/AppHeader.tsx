import React, { useState, useRef, useEffect } from "react";
import {
  Truck,
  Shield,
  Activity,
  Layers,
  FileCode,
  User,
  LogOut,
  Settings,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

interface AppHeaderProps {
  isLoading: boolean;
  onOpenRules: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isLoading, onOpenRules }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

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

        {/* Right Navigation & User Controls */}
        <div className="flex items-center gap-3 text-xs">
          {/* Service Status Badges */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700/60">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300 text-xs">OSRM Engine:</span>
            <span className="font-semibold text-white text-xs">Live</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700/60">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 text-xs">Open-Meteo:</span>
            <span className="font-semibold text-white text-xs">Live</span>
          </div>

          {/* Swagger API Docs Link */}
          <a
            href="http://127.0.0.1:4040/api/docs/"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold px-3 py-1.5 rounded-md border border-slate-700 transition-colors"
            title="Open OpenAPI 3.0 / Swagger UI"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs">API Docs</span>
          </a>

          {/* Safety Rules Reference */}
          <button
            onClick={onOpenRules}
            type="button"
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold px-3 py-1.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs">Safety Rules</span>
          </button>

          {/* User Profile Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                MV
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold leading-none">Marcus Vance</div>
                <div className="text-[10px] text-slate-400 leading-none mt-1">Fleet Ops #4</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg shadow-xl border border-slate-200 text-slate-800 py-1 z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                  <p className="font-bold text-slate-900 text-xs">Marcus Vance</p>
                  <p className="text-[10px] text-slate-500 font-mono">Senior Freight Dispatcher</p>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">● Dispatch Station Active</p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Dispatcher Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenRules();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Safety Threshold Settings</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      alert("You have been signed out of the dispatch console.");
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
