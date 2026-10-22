import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RouteAlternative, RouteCheckpoint } from "../types";

import { getRiskColor } from "../utils/colors";

interface RouteMapProps {
  routes: RouteAlternative[];
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  selectedCheckpoint: RouteCheckpoint | null;
  onSelectCheckpoint: (checkpoint: RouteCheckpoint) => void;
}

const ROUTE_PALETTE = [
  { stroke: "#2563eb", name: "Blue" },
  { stroke: "#8b5cf6", name: "Purple" },
  { stroke: "#0d9488", name: "Teal" },
];

export const RouteMap: React.FC<RouteMapProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  selectedCheckpoint,
  onSelectCheckpoint,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylinesLayerRef = useRef<L.LayerGroup | null>(null);
  const checkpointsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795], // Center of contiguous US
      zoom: 4,
      zoomControl: true,
    });

    // Clean modern OpenStreetMap / Carto tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    polylinesLayerRef.current = L.layerGroup().addTo(map);
    checkpointsLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update polylines and markers when routes or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !polylinesLayerRef.current || !checkpointsLayerRef.current || !markersLayerRef.current) {
      return;
    }

    polylinesLayerRef.current.clearLayers();
    checkpointsLayerRef.current.clearLayers();
    markersLayerRef.current.clearLayers();

    if (!routes || routes.length === 0) return;

    const bounds = L.latLngBounds([]);

    // 1. Draw route alternatives
    routes.forEach((route, idx) => {
      const isSelected = route.id === selectedRouteId;
      const palette = ROUTE_PALETTE[idx % ROUTE_PALETTE.length];
      const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);

      if (coords.length === 0) return;

      coords.forEach((c) => bounds.extend(c));

      // Polyline styling
      const polyline = L.polyline(coords, {
        color: isSelected ? palette.stroke : "#94a3b8",
        weight: isSelected ? 6 : 3.5,
        opacity: isSelected ? 0.95 : 0.6,
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

    // 2. Draw checkpoints for selected route
    const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
    if (activeRoute && activeRoute.checkpoints) {
      activeRoute.checkpoints.forEach((cp) => {
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

      // 3. Add Origin and Destination Endpoints
      const startCoord = activeRoute.geometry.coordinates[0];
      const endCoord = activeRoute.geometry.coordinates[activeRoute.geometry.coordinates.length - 1];

      if (startCoord) {
        const originIcon = L.divIcon({
          html: `<div style="background-color: #15803d; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">A</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        markersLayerRef.current.addLayer(
          L.marker([startCoord[1], startCoord[0]], { icon: originIcon }).bindTooltip("Origin")
        );
      }

      if (endCoord) {
        const destIcon = L.divIcon({
          html: `<div style="background-color: #b91c1c; color: white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">B</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        markersLayerRef.current.addLayer(
          L.marker([endCoord[1], endCoord[0]], { icon: destIcon }).bindTooltip("Destination")
        );
      }
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [routes, selectedRouteId, selectedCheckpoint, onSelectRoute, onSelectCheckpoint]);

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-lg overflow-hidden border border-slate-200 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md px-3 py-2.5 rounded-lg shadow-md border border-slate-200 text-xs text-slate-700 pointer-events-auto">
        <div className="font-semibold text-slate-900 mb-1.5 flex items-center justify-between">
          <span>Hazard Risk Legend</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span>Low Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            <span>Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
            <span>High Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            <span>Severe</span>
          </div>
          <div className="flex items-center gap-1.5 col-span-2">
            <span className="w-3 h-3 rounded-full bg-[#7f1d1d] inline-block ring-2 ring-red-300" />
            <span className="font-semibold text-red-950">No Travel (&gt;=55 mph / weight override)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
