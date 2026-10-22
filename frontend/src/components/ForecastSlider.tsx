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
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">48-Hour Forecast Horizon Timeline</h3>
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" /> Fetching forecast...
            </span>
          )}
        </div>
        <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium bg-slate-50 px-2.5 py-1 rounded border border-slate-200 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Departure +{offsetHours}h:</span>
          <span className="text-slate-900 font-semibold">{formattedTargetTime}</span>
        </div>
      </div>

      {/* Range Slider */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="range"
            min={0}
            max={48}
            step={1}
            value={offsetHours}
            onChange={(e) => onChangeOffset(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        {/* Quick Interval Shortcuts */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          {quickPills.map((hours) => (
            <button
              key={hours}
              onClick={() => onChangeOffset(hours)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                offsetHours === hours
                  ? "bg-blue-600 text-white font-bold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              +{hours}h
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-slate-400">
        Adjusting the timeline dynamically updates checkpoint weather forecasts, recalculates cargo-weight risk, and re-evaluates route safety across the next 48 hours.
      </div>
    </div>
  );
};
