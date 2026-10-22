import React, { useState, useEffect, useRef } from "react";
import { searchLocations, type LocationSearchResult } from "../api";
import { MapPin, Search, Loader2 } from "lucide-react";

interface AddressAutocompleteInputProps {
  label: string;
  value: string;
  onChange: (value: string, coord?: { lat: number; lon: number }) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  onTogglePickOnMap?: () => void;
  isPickingOnMap?: boolean;
}

export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  label,
  value,
  onChange,
  placeholder = "Search address or city...",
  icon,
  onTogglePickOnMap,
  isPickingOnMap,
}) => {
  const [suggestions, setSuggestions] = useState<LocationSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    onChange(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (text.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      const results = await searchLocations(text);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setIsLoading(false);
    }, 280);
  };

  const handleSelect = (item: LocationSearchResult) => {
    onChange(item.name, { lat: item.latitude, lon: item.longitude });
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </label>

        {onTogglePickOnMap && (
          <button
            type="button"
            onClick={onTogglePickOnMap}
            className={`text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
              isPickingOnMap
                ? "bg-rose-600 text-white shadow-xs animate-pulse"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
            title="Click here, then click on the map to set location"
          >
            <MapPin className="w-3 h-3" />
            <span>{isPickingOnMap ? "Cancel Pin" : "Pick on Map"}</span>
          </button>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          type="text"
          required
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full text-xs px-3.5 py-2.5 pr-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
        />
        <div className="absolute right-3 text-slate-400 pointer-events-none">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <Search className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
          {suggestions.map((item, idx) => (
            <li
              key={idx}
              onClick={() => handleSelect(item)}
              className="p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-800">{item.name}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
