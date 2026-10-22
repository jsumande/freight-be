import React from "react";
import type { CalculateRouteParams } from "../api";
import { AddressAutocompleteInput } from "./AddressAutocompleteInput";
import { Truck, Navigation, Calendar, Weight, Sliders, Play, RotateCcw } from "lucide-react";

interface RouteSearchFormProps {
  origin: string;
  setOrigin: (val: string) => void;
  destination: string;
  setDestination: (val: string) => void;
  departureTime: string;
  setDepartureTime: (val: string) => void;
  cargoWeightLbs: number;
  setCargoWeightLbs: (val: number) => void;
  intervalMiles: number;
  setIntervalMiles: (val: number) => void;
  onSearch: (params: CalculateRouteParams) => void;
  isLoading: boolean;
  isPickingOnMap: "origin" | "destination" | null;
  onTogglePickOnMap: (target: "origin" | "destination") => void;
}

const PRESET_CORRIDORS = [
  { name: "Chicago → Milwaukee (90 mi)", origin: "Chicago, IL", destination: "Milwaukee, WI", weight: 35000 },
  { name: "Denver → Salt Lake City (520 mi)", origin: "Denver, CO", destination: "Salt Lake City, UT", weight: 42000 },
  { name: "Dallas → Kansas City (550 mi)", origin: "Dallas, TX", destination: "Kansas City, MO", weight: 32000 },
];

export const RouteSearchForm: React.FC<RouteSearchFormProps> = ({
  origin,
  setOrigin,
  destination,
  setDestination,
  departureTime,
  setDepartureTime,
  cargoWeightLbs,
  setCargoWeightLbs,
  intervalMiles,
  setIntervalMiles,
  onSearch,
  isLoading,
  isPickingOnMap,
  onTogglePickOnMap,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;

    onSearch({
      origin: origin.trim(),
      destination: destination.trim(),
      departure_time: new Date(departureTime).toISOString(),
      cargo_weight_lbs: cargoWeightLbs,
      checkpoint_interval_miles: intervalMiles,
    });
  };

  const applyPreset = (preset: typeof PRESET_CORRIDORS[0]) => {
    setOrigin(preset.origin);
    setDestination(preset.destination);
    setCargoWeightLbs(preset.weight);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">Trip & Cargo Parameters</h2>
        </div>
        <span className="text-xs text-slate-500 font-mono">Commercial Dispatch</span>
      </div>

      {/* Quick Corridor Presets */}
      <div>
        <div className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
          <span>Preset Test Corridors</span>
          <span className="text-[11px] text-slate-400">Click to autofill</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_CORRIDORS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="text-xs bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 px-2.5 py-1 rounded transition-colors"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Origin & Destination Autocomplete Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AddressAutocompleteInput
          label="Origin Location"
          value={origin}
          onChange={(val) => setOrigin(val)}
          placeholder="Type address, city or click Pin..."
          icon={<Navigation className="w-3.5 h-3.5 text-emerald-600" />}
          onTogglePickOnMap={() => onTogglePickOnMap("origin")}
          isPickingOnMap={isPickingOnMap === "origin"}
        />

        <AddressAutocompleteInput
          label="Destination Location"
          value={destination}
          onChange={(val) => setDestination(val)}
          placeholder="Type address, city or click Pin..."
          icon={<Navigation className="w-3.5 h-3.5 text-rose-600" />}
          onTogglePickOnMap={() => onTogglePickOnMap("destination")}
          isPickingOnMap={isPickingOnMap === "destination"}
        />
      </div>

      {/* Departure Time & Cargo Weight */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" /> Departure Date & Time
          </label>
          <input
            type="datetime-local"
            required
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Weight className="w-3.5 h-3.5 text-slate-500" /> Cargo Weight (lbs)
            </label>
            <span className="text-xs font-mono font-bold text-blue-700">
              {cargoWeightLbs.toLocaleString()} lbs
            </span>
          </div>
          <input
            type="number"
            min={0}
            max={80000}
            step={500}
            value={cargoWeightLbs}
            onChange={(e) => setCargoWeightLbs(parseFloat(e.target.value) || 0)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <div className="flex gap-1.5 mt-1.5">
            {[20000, 32000, 42000, 75000].map((wt) => (
              <button
                key={wt}
                type="button"
                onClick={() => setCargoWeightLbs(wt)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  cargoWeightLbs === wt
                    ? "bg-slate-800 text-white border-slate-800 font-bold"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {wt >= 40000 ? `${wt / 1000}k (Heavy)` : `${wt / 1000}k`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Checkpoint Spacing & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">Sampling Interval:</span>
          <div className="flex gap-1">
            {[10, 25, 50].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setIntervalMiles(val)}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  intervalMiles === val
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {val} mi
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow transition-all cursor-pointer"
        >
          {isLoading ? (
            <>
              <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Evaluating Weather Along Routes...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" /> Evaluate Route Safety
            </>
          )}
        </button>
      </div>
    </form>
  );
};
