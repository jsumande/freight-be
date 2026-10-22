import React, { useMemo } from "react";
import { Clock, Calendar, RefreshCw } from "lucide-react";

interface ForecastSliderProps {
  offsetHours: number;
  onChangeOffset: (offset: number) => void;
  baseDepartureTime: string;
  isLoading: boolean;
}

export const ForecastSlider: React.FC<ForecastSliderProps> = ({
  offsetHours,
  onChangeOffset,
  baseDepartureTime,
  isLoading,
}) => {
  const formattedTargetTime = useMemo(() => {
    const baseDate = baseDepartureTime ? new Date(baseDepartureTime) : new Date(0);
    const simDate = new Date(baseDate.getTime() + offsetHours * 3600 * 1000);
    return simDate.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [baseDepartureTime, offsetHours]);

  const quickPills = [0, 6, 12, 24, 36, 48];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">48-Hour Forecast Horizon Timeline</h3>
            <p className="text-[11px] text-slate-400">Scrub forward to evaluate temporal storm progression</p>
          </div>
          {isLoading && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching forecast...
            </span>
          )}
        </div>
        <div className="text-xs text-slate-600 flex items-center gap-2 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Departure +{offsetHours}h:</span>
          <span className="text-slate-900 font-bold font-mono">{formattedTargetTime}</span>
        </div>
      </div>

      {/* Range Slider */}
      <div className="space-y-3 pt-1">
        <div className="relative">
          <input
            type="range"
            min={0}
            max={48}
            step={1}
            value={offsetHours}
            onChange={(e) => onChangeOffset(parseInt(e.target.value, 10))}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all"
          />
        </div>

        {/* Quick Interval Shortcuts */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {quickPills.map((hours) => (
            <button
              key={hours}
              onClick={() => onChangeOffset(hours)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                offsetHours === hours
                  ? "bg-blue-600 text-white font-bold shadow-xs scale-105"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              +{hours}h
            </button>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-slate-400 pt-0.5">
        Adjusting the timeline dynamically updates checkpoint weather forecasts, recalculates cargo-weight risk, and re-evaluates route safety across the next 48 hours.
      </div>
    </div>
  );
};
