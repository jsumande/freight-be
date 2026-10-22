import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteAlternative, RouteCheckpoint } from "../types";
import { getRiskColor } from "../utils/colors";
import { Flame, Wind, CloudRain, EyeOff, Layers, Maximize2, ChevronDown, ChevronUp } from "lucide-react";

interface RouteMapProps {
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  selectedCheckpoint: RouteCheckpoint | null;
  onSelectCheckpoint: (checkpoint: RouteCheckpoint) => void;
  isPickingLocation?: "origin" | "destination" | null;
  onMapClickLocation?: (lat: number, lon: number) => void;
  onCancelPickLocation?: () => void;
}

type OverlayMode = "risk" | "wind" | "precip" | "none";

const ROUTE_PALETTE = [
  { stroke: "#2563eb", name: "Blue" },
  { stroke: "#8b5cf6", name: "Purple" },
  { stroke: "#0d9488", name: "Teal" },
];

function getWindColor(mph: number | null): string {
  if (mph === null) return "#94a3b8";
  if (mph < 15) return "#38bdf8"; // Light Blue
  if (mph < 25) return "#10b981"; // Emerald
  if (mph < 35) return "#f59e0b"; // Amber
  if (mph < 45) return "#f97316"; // Orange
  if (mph < 55) return "#ef4444"; // Red
  return "#7f1d1d"; // Deep Maroon
}

function getPrecipColor(rain: number | null, snow: number | null): string {
  const total = (rain || 0) + (snow || 0);
  if (total <= 0.001) return "#94a3b8";
  if (total < 0.1) return "#38bdf8";
  if (total < 0.25) return "#6366f1";
  if (total < 0.5) return "#8b5cf6";
  if (total <= 1.0) return "#ec4899";
  return "#991b1b";
}

export const RouteMap: React.FC<RouteMapProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  selectedCheckpoint,
  onSelectCheckpoint,
  isPickingLocation = null,
  onMapClickLocation,
  onCancelPickLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const polylinesLayerRef = useRef<L.LayerGroup | null>(null);
  const checkpointsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const currentBoundsRef = useRef<L.LatLngBounds | null>(null);

  // Auto-resize Leaflet on window or layout container resize
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.invalidateSize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Overlay visualization mode (defaults to Risk Corridor Heatmap)
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("risk");
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(true);

  // Handle map click when in location picking mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isPickingLocation) {
      L.DomUtil.addClass(map.getContainer(), "cursor-crosshair");
    } else {
      L.DomUtil.removeClass(map.getContainer(), "cursor-crosshair");
    }

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isPickingLocation && onMapClickLocation) {
        onMapClickLocation(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [isPickingLocation, onMapClickLocation]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795], // Center of contiguous US
      zoom: 4,
      zoomControl: true,
    });

    // OpenStreetMap standard tiles (100% free, no API key required)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Order of layer groups: Heatmap corridor (bottom) -> Polylines -> Checkpoints -> Markers (top)
    heatmapLayerRef.current = L.layerGroup().addTo(map);
    polylinesLayerRef.current = L.layerGroup().addTo(map);
    checkpointsLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update polylines, heatmap corridor, and markers when routes or overlayMode changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (
      !map ||
      !heatmapLayerRef.current ||
      !polylinesLayerRef.current ||
      !checkpointsLayerRef.current ||
      !markersLayerRef.current
    ) {
      return;
    }

    heatmapLayerRef.current.clearLayers();
    polylinesLayerRef.current.clearLayers();
    checkpointsLayerRef.current.clearLayers();
    markersLayerRef.current.clearLayers();

    if (!routes || routes.length === 0) return;

    const bounds = L.latLngBounds([]);

    // 1. Draw route alternatives base lines
    routes.forEach((route, idx) => {
      const isSelected = route.id === selectedRouteId;
      const palette = ROUTE_PALETTE[idx % ROUTE_PALETTE.length];
      const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);

      if (coords.length === 0) return;

      coords.forEach((c) => bounds.extend(c));

      // Core highway line
      const polyline = L.polyline(coords, {
        color: isSelected ? palette.stroke : "#94a3b8",
        weight: isSelected ? 5 : 3.5,
        opacity: isSelected ? 0.95 : 0.5,
        dashArray: isSelected ? undefined : "6, 8",
        lineCap: "round",
        lineJoin: "round",
      });

      polyline.on("click", () => {
        onSelectRoute(route.id);
      });

      polyline.bindTooltip(
        `<strong>${route.name}</strong><br/>${route.distance_miles.toFixed(1)} mi • ${route.duration_formatted}`,
        { sticky: true }
      );

      polylinesLayerRef.current?.addLayer(polyline);
    });

    const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

    // 2. Draw Weather Corridor Heatmap Overlay (if enabled)
    if (activeRoute && activeRoute.checkpoints && overlayMode !== "none") {
      const cps = activeRoute.checkpoints;

      // Draw corridor heat halo buffer along checkpoint segments
      for (let i = 0; i < cps.length; i++) {
        const cp = cps[i];

        let heatColor: string;
        let tooltipText: string;

        if (overlayMode === "risk") {
          heatColor = getRiskColor(cp.risk.overall_risk);
          tooltipText = `Corridor Risk: ${cp.risk.overall_risk}`;
        } else if (overlayMode === "wind") {
          heatColor = getWindColor(cp.weather.wind_speed_mph);
          tooltipText = `Wind Speed: ${cp.weather.wind_speed_mph ?? 0} mph`;
        } else {
          // precip
          heatColor = getPrecipColor(cp.weather.rainfall_in_hr, cp.weather.snowfall_in_hr);
          tooltipText = `Precipitation: ${cp.weather.rainfall_in_hr ?? 0} in/hr rain, ${cp.weather.snowfall_in_hr ?? 0} in/hr snow`;
        }

        // A. Continuous wide corridor heat ribbon between consecutive checkpoints
        if (i < cps.length - 1) {
          const nextCp = cps[i + 1];
          const segmentLine = L.polyline(
            [
              [cp.latitude, cp.longitude],
              [nextCp.latitude, nextCp.longitude],
            ],
            {
              color: heatColor,
              weight: 18,
              opacity: 0.5,
              lineCap: "round",
              lineJoin: "round",
            }
          );
          segmentLine.bindTooltip(
            `<strong>Weather Corridor (Mile ${cp.cumulative_miles.toFixed(0)} - ${nextCp.cumulative_miles.toFixed(0)})</strong><br/>${tooltipText}`,
            { sticky: true }
          );
          heatmapLayerRef.current.addLayer(segmentLine);
        }

        // B. Radial Weather Hazard Footprint (Heat Halo) around checkpoint
        const haloRadiusMeters = cp.risk.overall_risk === "NO_TRAVEL" ? 28000 : 18000;
        const heatHalo = L.circle([cp.latitude, cp.longitude], {
          radius: haloRadiusMeters,
          fillColor: heatColor,
          fillOpacity: cp.risk.overall_risk === "NO_TRAVEL" ? 0.35 : 0.2,
          stroke: true,
          color: heatColor,
          weight: 1.5,
          opacity: 0.6,
        });
        heatHalo.bindTooltip(
          `<strong>Checkpoint ${cp.index} Footprint</strong><br/>${tooltipText}`,
          { sticky: true }
        );
        heatmapLayerRef.current.addLayer(heatHalo);
      }
    }

    // 3. Draw Checkpoint Pin Markers for selected route
    if (activeRoute && activeRoute.checkpoints) {
      activeRoute.checkpoints.forEach((cp) => {
        // Point A (Origin) endpoint marker represents Checkpoint 0 cleanly without double-layering
        if (cp.index === 0) return;

        const isSelected = selectedCheckpoint?.index === cp.index;
        const riskColor = getRiskColor(cp.risk.overall_risk);
        const hasNoTravel = cp.risk.overall_risk === "NO_TRAVEL";

        const iconHtml = `
          <div style="
            background-color: ${riskColor};
            width: ${isSelected ? 26 : 18}px;
            height: ${isSelected ? 26 : 18}px;
            border-radius: 50%;
            border: ${isSelected ? "3px solid #ffffff" : "2px solid #ffffff"};
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: ${isSelected ? "11px" : "9px"};
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.15s ease;
            ${hasNoTravel ? "box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.4);" : ""}
          ">
            ${hasNoTravel ? "!" : cp.index}
          </div>
        `;

        const markerIcon = L.divIcon({
          html: iconHtml,
          className: "custom-checkpoint-marker",
          iconSize: [isSelected ? 26 : 18, isSelected ? 26 : 18],
          iconAnchor: [isSelected ? 13 : 9, isSelected ? 13 : 9],
        });

        const marker = L.marker([cp.latitude, cp.longitude], { icon: markerIcon });
        marker.on("click", () => {
          onSelectCheckpoint(cp);
        });

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; min-width: 170px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; display: flex; justify-content: space-between;">
              <span>Checkpoint ${cp.index}</span>
              <span style="color: ${riskColor}; font-weight: 800;">${cp.risk.overall_risk}</span>
            </div>
            <div style="font-size: 12px; color: #4b5563;">
              <div><strong>Distance:</strong> ${cp.cumulative_miles.toFixed(1)} mi</div>
              <div><strong>ETA:</strong> ${new Date(cp.estimated_arrival_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              <div><strong>Wind:</strong> ${cp.weather.wind_speed_mph ?? "--"} mph</div>
              <div><strong>Rain:</strong> ${cp.weather.rainfall_in_hr ?? 0} in/hr</div>
              <div><strong>Snow:</strong> ${cp.weather.snowfall_in_hr ?? 0} in/hr</div>
              ${cp.risk.weight_override_applied ? `<div style="color: #b91c1c; font-weight: 600; margin-top: 4px;">⚠️ Weight Override Applied</div>` : ""}
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
        checkpointsLayerRef.current?.addLayer(marker);
      });

      // 4. Add Origin and Destination Endpoints
      const startCoord = activeRoute.geometry.coordinates[0];
      const endCoord = activeRoute.geometry.coordinates[activeRoute.geometry.coordinates.length - 1];

      if (startCoord) {
        const originCp = activeRoute.checkpoints.find((c) => c.index === 0) || activeRoute.checkpoints[0];
        const isSelected = selectedCheckpoint?.index === 0;
        const originRiskColor = originCp ? getRiskColor(originCp.risk.overall_risk) : "#15803d";
        const originIcon = L.divIcon({
          html: `<div style="background-color: #15803d; color: white; border-radius: 50%; width: ${isSelected ? 28 : 24}px; height: ${isSelected ? 28 : 24}px; display: flex; align-items: center; justify-content: center; font-size: ${isSelected ? "13px" : "11px"}; font-weight: bold; border: ${isSelected ? "3px solid #ffffff" : "2px solid white"}; box-shadow: 0 2px 6px rgba(0,0,0,0.4); outline: 2px solid ${originRiskColor}; cursor: pointer;">A</div>`,
          iconSize: [isSelected ? 28 : 24, isSelected ? 28 : 24],
          iconAnchor: [isSelected ? 14 : 12, isSelected ? 14 : 12],
        });
        const originMarker = L.marker([startCoord[1], startCoord[0]], { icon: originIcon });
        originMarker.bindTooltip("Origin (Point A) • Departure Point");
        if (originCp) {
          originMarker.on("click", () => {
            onSelectCheckpoint(originCp);
          });
        }
        markersLayerRef.current.addLayer(originMarker);
      }

      if (endCoord) {
        const lastCp = activeRoute.checkpoints[activeRoute.checkpoints.length - 1];
        const isSelected = selectedCheckpoint?.index === lastCp?.index;
        const destIcon = L.divIcon({
          html: `<div style="background-color: #b91c1c; color: white; border-radius: 50%; width: ${isSelected ? 28 : 24}px; height: ${isSelected ? 28 : 24}px; display: flex; align-items: center; justify-content: center; font-size: ${isSelected ? "13px" : "11px"}; font-weight: bold; border: ${isSelected ? "3px solid #ffffff" : "2px solid white"}; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor: pointer;">B</div>`,
          iconSize: [isSelected ? 28 : 24, isSelected ? 28 : 24],
          iconAnchor: [isSelected ? 14 : 12, isSelected ? 14 : 12],
        });
        const destMarker = L.marker([endCoord[1], endCoord[0]], { icon: destIcon });
        destMarker.bindTooltip("Destination (Point B)");
        if (lastCp) {
          destMarker.on("click", () => {
            onSelectCheckpoint(lastCp);
          });
        }
        markersLayerRef.current.addLayer(destMarker);
      }
    }

    currentBoundsRef.current = bounds;
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [routes, selectedRouteId, selectedCheckpoint, overlayMode, onSelectRoute, onSelectCheckpoint]);

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Location Picking Mode Banner */}
      {isPickingLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-rose-600 text-white px-5 py-2.5 rounded-full shadow-xl border border-white flex items-center gap-3.5 text-xs font-bold animate-bounce">
          <span>
            📍 Click anywhere on the map to set{" "}
            {isPickingLocation === "origin" ? "Origin (Point A)" : "Destination (Point B)"}
          </span>
          {onCancelPickLocation && (
            <button
              type="button"
              onClick={onCancelPickLocation}
              className="bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Floating Top-Right Overlay Selector */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md p-2 rounded-xl shadow-lg border border-slate-200 text-xs">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" /> Corridor Overlay
          </div>
          <button
            type="button"
            onClick={() => {
              if (mapInstanceRef.current && currentBoundsRef.current && currentBoundsRef.current.isValid()) {
                mapInstanceRef.current.fitBounds(currentBoundsRef.current, { padding: [40, 40], maxZoom: 14 });
              }
            }}
            className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors"
            title="Reset map zoom to fit all routes"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fit Route</span>
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setOverlayMode("risk")}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
              overlayMode === "risk"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
            title="Show overall risk level corridor heatmap"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Risk Heatmap</span>
          </button>

          <button
            type="button"
            onClick={() => setOverlayMode("wind")}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
              overlayMode === "wind"
                ? "bg-cyan-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
            title="Show wind speed corridor heatmap"
          >
            <Wind className="w-3.5 h-3.5" />
            <span>Wind Heat</span>
          </button>

          <button
            type="button"
            onClick={() => setOverlayMode("precip")}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
              overlayMode === "precip"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
            title="Show rainfall & snowfall corridor heatmap"
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>Precipitation</span>
          </button>

          <button
            type="button"
            onClick={() => setOverlayMode("none")}
            className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold transition-colors cursor-pointer ${
              overlayMode === "none"
                ? "bg-slate-800 text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
            title="Hide corridor heatmap overlay"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Off</span>
          </button>
        </div>
      </div>

      {/* Floating Bottom-Left Map Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 text-xs text-slate-700 pointer-events-auto max-w-[calc(100%-2rem)] transition-all">
        <div
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className="px-3.5 py-2 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 rounded-xl select-none"
        >
          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <span>
              {overlayMode === "wind"
                ? "Wind Speed Gradient"
                : overlayMode === "precip"
                ? "Precipitation Gradient"
                : "Hazard Risk Corridor Legend"}
            </span>
          </span>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
            title={isLegendOpen ? "Collapse Legend" : "Expand Legend"}
          >
            {isLegendOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isLegendOpen && (
          <div className="px-3.5 pb-3 pt-1 border-t border-slate-100">
            {overlayMode === "wind" ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#38bdf8] inline-block shadow-2xs" />
                  <span className="text-[11px]">&lt; 15 mph</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-2xs" />
                  <span className="text-[11px]">15–25 mph</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-2xs" />
                  <span className="text-[11px]">25–35 mph</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 inline-block shadow-2xs" />
                  <span className="text-[11px]">35–45 mph</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-2xs" />
                  <span className="text-[11px]">45–55 mph</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#7f1d1d] inline-block ring-2 ring-red-300 shadow-2xs" />
                  <span className="font-bold text-red-950 text-[11px]">&ge; 55 mph</span>
                </div>
              </div>
            ) : overlayMode === "precip" ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#94a3b8] inline-block shadow-2xs" />
                  <span className="text-[11px]">Dry / Clear</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#38bdf8] inline-block shadow-2xs" />
                  <span className="text-[11px]">Light (&lt;0.10 in)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#6366f1] inline-block shadow-2xs" />
                  <span className="text-[11px]">0.10–0.25 in</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#8b5cf6] inline-block shadow-2xs" />
                  <span className="text-[11px]">0.25–0.50 in</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ec4899] inline-block shadow-2xs" />
                  <span className="text-[11px]">0.50–1.00 in</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#991b1b] inline-block ring-2 ring-red-300 shadow-2xs" />
                  <span className="font-bold text-red-950 text-[11px]">&gt; 1.00 in/hr</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-2xs" />
                  <span className="text-[11px]">Low Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block shadow-2xs" />
                  <span className="text-[11px]">Moderate</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 inline-block shadow-2xs" />
                  <span className="text-[11px]">High Risk</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-2xs" />
                  <span className="text-[11px]">Severe</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <span className="w-3 h-3 rounded-full bg-[#7f1d1d] inline-block ring-2 ring-red-300 shadow-2xs" />
                  <span className="font-semibold text-red-950 text-[11px]">No Travel (&ge;55 mph / weight override)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
