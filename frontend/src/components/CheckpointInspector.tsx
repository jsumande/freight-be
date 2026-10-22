import React from "react";
import type { RouteCheckpoint } from "../types";
import { getRiskColor } from "../utils/colors";
import {
  Wind,
  CloudRain,
  Snowflake,
  Thermometer,
  AlertTriangle,
  ShieldCheck,
  Clock,
  X,
  Gauge,
} from "lucide-react";

interface CheckpointInspectorProps {
  checkpoint: RouteCheckpoint | null;
  onClose: () => void;
  cargoWeightLbs: number;
}

export const CheckpointInspector: React.FC<CheckpointInspectorProps> = ({
  checkpoint,
  onClose,
  cargoWeightLbs,
}) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!checkpoint) {
    return null;
  }

  const { weather, risk, cumulative_miles, estimated_arrival_time, index } = checkpoint;
  const overallColor = getRiskColor(risk.overall_risk);
  const formattedEta = new Date(estimated_arrival_time).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="absolute top-4 right-4 bottom-24 z-[1100] w-88 sm:w-96 bg-white/98 backdrop-blur-md border border-slate-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto transition-all animate-in fade-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold text-white shadow-xs shrink-0"
            style={{ backgroundColor: overallColor }}
          >
            {index === 0 ? "A" : index}
          </span>
          <div>
            <h4 className="text-sm font-bold leading-none">
              {index === 0 ? "Checkpoint 0 Details (Origin Departure)" : `Checkpoint ${index} Details`}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 leading-none font-mono">
              {index === 0 ? "Trip Origin • Mile 0.0 Departure" : `Mile ${cumulative_miles.toFixed(1)} from Origin`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Close Inspector (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
        {/* Evaluated Status Banner */}
        <div
          className="p-3.5 rounded-xl flex items-center justify-between text-white shadow-sm"
          style={{ backgroundColor: overallColor }}
        >
          <div className="flex items-center gap-2.5">
            {risk.overall_risk === "NO_TRAVEL" ? (
              <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-white" />
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider font-extrabold opacity-90">Evaluated Risk</div>
              <div className="text-base font-extrabold tracking-tight">{risk.overall_risk.replace("_", " ")}</div>
            </div>
          </div>
          <div className="text-right text-xs opacity-90 flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>ETA: {formattedEta}</span>
          </div>
        </div>

        {/* Cargo Weight Override Alert (if active) */}
        {risk.weight_override_applied && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-amber-950 text-xs shadow-2xs">
            <div className="flex items-center gap-1.5 font-bold mb-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>CARGO-WEIGHT RISK OVERRIDE APPLIED</span>
            </div>
            <p className="text-slate-700 leading-relaxed text-[11px]">
              {risk.override_reason ||
                `Cargo load of ${cargoWeightLbs.toLocaleString()} lbs in high winds triggered an escalated safety classification.`}
            </p>
          </div>
        )}

        {/* Weather Hazards Grid */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-slate-400" />
            <span>Forecast Meteorological Measurements</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {/* Wind */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-xs">
                  <Wind className="w-3.5 h-3.5 text-blue-500" /> Wind
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                  style={{ backgroundColor: getRiskColor(risk.wind_risk) }}
                >
                  {risk.wind_risk}
                </span>
              </div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {weather.wind_speed_mph !== null ? `${weather.wind_speed_mph} mph` : "N/A"}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Low &lt;25 / No Travel &ge;55</div>
            </div>

            {/* Rain */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-xs">
                  <CloudRain className="w-3.5 h-3.5 text-indigo-500" /> Rainfall
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                  style={{ backgroundColor: getRiskColor(risk.rain_risk) }}
                >
                  {risk.rain_risk}
                </span>
              </div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {weather.rainfall_in_hr !== null ? `${weather.rainfall_in_hr} in/hr` : "0.0 in/hr"}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Severe 0.50–1.00 in/hr</div>
            </div>

            {/* Snow */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-xs">
                  <Snowflake className="w-3.5 h-3.5 text-cyan-500" /> Snowfall
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs"
                  style={{ backgroundColor: getRiskColor(risk.snow_risk) }}
                >
                  {risk.snow_risk}
                </span>
              </div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {weather.snowfall_in_hr !== null ? `${weather.snowfall_in_hr} in/hr` : "0.0 in/hr"}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Severe 2.0–3.0 in/hr</div>
            </div>

            {/* Temp & Condition */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center text-slate-500 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-xs">
                  <Thermometer className="w-3.5 h-3.5 text-rose-500" /> Temp
                </span>
              </div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">
                {weather.temperature_f !== null ? `${weather.temperature_f}°F` : "--"}
              </div>
              <div className="text-[11px] text-slate-600 truncate font-medium mt-1">
                {weather.condition_description}
              </div>
            </div>
          </div>
        </div>

        {/* Spatial & Timing Metadata */}
        <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400 font-sans">Geographic Coord:</span>
            <span className="font-bold text-slate-800">
              {checkpoint.latitude.toFixed(4)}, {checkpoint.longitude.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-sans">Corridor Length:</span>
            <span className="font-bold text-slate-800">{checkpoint.segment_miles.toFixed(1)} miles</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-sans">Forecast Source:</span>
            <span className={weather.is_available ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
              {weather.is_available ? "Open-Meteo High-Res" : "Horizon Limit"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
