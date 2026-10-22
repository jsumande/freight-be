import React from "react";
import type { RouteCheckpoint } from "../types";
import { getRiskColor } from "../utils/colors";
import { Wind, CloudRain, Snowflake, Thermometer, AlertTriangle, ShieldCheck, Clock, MapPin, X } from "lucide-react";

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
  if (!checkpoint) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-center text-slate-500 text-sm">
        <MapPin className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-60" />
        <p className="font-medium text-slate-700">No Checkpoint Selected</p>
        <p className="text-xs text-slate-500 mt-1">
          Click any numbered checkpoint marker along the route to inspect its local weather forecast and risk calculations.
        </p>
      </div>
    );
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
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: overallColor }}
          >
            {index}
          </span>
          <div>
            <h4 className="text-sm font-semibold leading-tight">Checkpoint {index} Details</h4>
            <p className="text-[11px] text-slate-400">Mile {cumulative_miles.toFixed(1)} from Origin</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Overall Status Banner */}
        <div
          className="p-3 rounded-md flex items-center justify-between text-white"
          style={{ backgroundColor: overallColor }}
        >
          <div className="flex items-center gap-2">
            {risk.overall_risk === "NO_TRAVEL" ? (
              <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-white" />
            )}
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold opacity-90">Evaluated Risk</div>
              <div className="text-base font-bold tracking-tight">{risk.overall_risk.replace("_", " ")}</div>
            </div>
          </div>
          <div className="text-right text-xs opacity-90 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>ETA: {formattedEta}</span>
          </div>
        </div>

        {/* Cargo Weight Override Alert */}
        {risk.weight_override_applied && (
          <div className="bg-amber-50 border border-amber-300 rounded-md p-3 text-amber-900 text-xs">
            <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>CARGO-WEIGHT RISK OVERRIDE APPLIED</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              {risk.override_reason || `Cargo load of ${cargoWeightLbs.toLocaleString()} lbs in high wind triggered an elevated safety classification.`}
            </p>
          </div>
        )}

        {/* Weather Observations Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Wind */}
          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Wind className="w-3.5 h-3.5 text-blue-500" /> Wind Speed
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: getRiskColor(risk.wind_risk) }}
              >
                {risk.wind_risk}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-800">
              {weather.wind_speed_mph !== null ? `${weather.wind_speed_mph} mph` : "N/A"}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Thresholds: 25 / 35 / 45 / 55 mph</div>
          </div>

          {/* Rain */}
          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <CloudRain className="w-3.5 h-3.5 text-indigo-500" /> Rainfall
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: getRiskColor(risk.rain_risk) }}
              >
                {risk.rain_risk}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-800">
              {weather.rainfall_in_hr !== null ? `${weather.rainfall_in_hr} in/hr` : "0.0 in/hr"}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Thresholds: 0.10 / 0.25 / 0.50 / 1.00 in</div>
          </div>

          {/* Snow */}
          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Snowflake className="w-3.5 h-3.5 text-cyan-500" /> Snowfall
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: getRiskColor(risk.snow_risk) }}
              >
                {risk.snow_risk}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-800">
              {weather.snowfall_in_hr !== null ? `${weather.snowfall_in_hr} in/hr` : "0.0 in/hr"}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Thresholds: 0.5 / 1.0 / 2.0 / 3.0 in</div>
          </div>

          {/* Temp & Sky */}
          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
            <div className="flex items-center text-slate-500 mb-1">
              <span className="flex items-center gap-1 font-medium">
                <Thermometer className="w-3.5 h-3.5 text-rose-500" /> Temperature
              </span>
            </div>
            <div className="text-lg font-bold text-slate-800">
              {weather.temperature_f !== null ? `${weather.temperature_f}°F` : "--"}
            </div>
            <div className="text-[11px] text-slate-600 truncate mt-0.5 font-medium">
              {weather.condition_description}
            </div>
          </div>
        </div>

        {/* Timing Information */}
        <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
          <div className="flex justify-between">
            <span>Coordinate:</span>
            <span className="font-mono text-slate-700">{checkpoint.latitude.toFixed(4)}, {checkpoint.longitude.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span>Represented Corridor:</span>
            <span className="font-medium text-slate-700">{checkpoint.segment_miles.toFixed(1)} miles</span>
          </div>
          <div className="flex justify-between">
            <span>Forecast Availability:</span>
            <span className={weather.is_available ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>
              {weather.is_available ? "Live Open-Meteo Verified" : "Data Window Limitation"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
