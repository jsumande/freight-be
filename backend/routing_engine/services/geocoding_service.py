"""
Geocoding Service

Resolves user-entered origin and destination strings into geographic coordinates.
Uses Open-Meteo Geocoding API with OpenStreetMap Nominatim fallback and LRU/dictionary caching.
"""

import logging
import re
from typing import Optional, Dict, Any
import requests
from routing_engine.domain.models import Coordinate

logger = logging.getLogger(__name__)

# In-memory geocoding cache to minimize duplicate network requests
_GEOCODE_CACHE: Dict[str, Dict[str, Any]] = {}


class GeocodingError(Exception):
    """Raised when an address cannot be resolved to geographic coordinates."""
    pass


def parse_coordinate_string(query: str) -> Optional[Coordinate]:
    """Checks if the query is already in 'lat, lon' or 'lat lon' format."""
    cleaned = query.strip()
    match = re.match(r"^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$", cleaned)
    if match:
        lat = float(match.group(1))
        lon = float(match.group(2))
        if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
            return Coordinate(latitude=lat, longitude=lon)
    return None


def geocode_location(query: str, timeout: float = 6.0) -> Dict[str, Any]:
    """
    Geocodes an address or place name into coordinates and formatted display name.
    
    Returns:
        dict: {
            "query": query,
            "name": formatted_name,
            "latitude": float,
            "longitude": float,
            "timezone": str,
        }
    """
    if not query or not query.strip():
        raise GeocodingError("Location query cannot be empty.")

    normalized = query.strip().lower()
    if normalized in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[normalized]

    # Check direct coordinate input
    direct_coord = parse_coordinate_string(query)
    if direct_coord:
        result = {
            "query": query,
            "name": f"Coordinate ({direct_coord.latitude:.4f}, {direct_coord.longitude:.4f})",
            "latitude": direct_coord.latitude,
            "longitude": direct_coord.longitude,
            "timezone": "UTC",
        }
        _GEOCODE_CACHE[normalized] = result
        return result

    # 1. Primary: Open-Meteo Geocoding API
    try:
        url = "https://geocoding-api.open-meteo.com/v1/search"
        params = {"name": query.strip(), "count": 1, "language": "en", "format": "json"}
        resp = requests.get(url, params=params, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results")
            if results and len(results) > 0:
                top = results[0]
                name_parts = [top.get("name", "")]
                if top.get("admin1"):
                    name_parts.append(top["admin1"])
                if top.get("country"):
                    name_parts.append(top["country"])
                display_name = ", ".join(name_parts)

                result = {
                    "query": query,
                    "name": display_name,
                    "latitude": float(top["latitude"]),
                    "longitude": float(top["longitude"]),
                    "timezone": top.get("timezone", "UTC"),
                }
                _GEOCODE_CACHE[normalized] = result
                return result
    except Exception as exc:
        logger.warning("Open-Meteo geocoding request failed for '%s': %s", query, exc)

    # 2. Fallback: OpenStreetMap Nominatim
    try:
        nom_url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "WeatherAwareTruckRoutingApp/1.0 (commercial-freight-evaluation)"}
        params = {"q": query.strip(), "format": "json", "limit": 1}
        resp = requests.get(nom_url, params=params, headers=headers, timeout=timeout)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                top = data[0]
                result = {
                    "query": query,
                    "name": top.get("display_name", query),
                    "latitude": float(top["lat"]),
                    "longitude": float(top["lon"]),
                    "timezone": "UTC",
                }
                _GEOCODE_CACHE[normalized] = result
                return result
    except Exception as exc:
        logger.warning("Nominatim geocoding fallback failed for '%s': %s", query, exc)

    raise GeocodingError(f"Unable to geocode location: '{query}'. Please verify spelling or provide coordinates.")
