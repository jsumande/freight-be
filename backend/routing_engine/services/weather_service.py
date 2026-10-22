"""
Weather Service Interface and Open-Meteo Implementation

Retrieves hourly forecast predictions for coordinates and target arrival timestamps.
Extracts wind speed (mph), rain intensity (in/hr), snowfall intensity (in/hr), and WMO condition codes.
Enforces forecast horizon boundaries and handles timezone alignment in UTC.
"""

from datetime import datetime, timezone, timedelta
import logging
from typing import Dict, Any, Optional, List, Tuple
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from routing_engine.domain.models import Coordinate, WeatherObservation

logger = logging.getLogger(__name__)

# Weather cache: (rounded_lat, rounded_lon, date_str) -> raw open-meteo hourly payload
_WEATHER_CACHE: Dict[Tuple[float, float, str], Dict[str, Any]] = {}

# Resilient Session with retries and connection pooling
_SESSION = requests.Session()
_RETRIES = Retry(total=3, backoff_factor=0.3, status_forcelist=[500, 502, 503, 504])
_SESSION.mount("https://", HTTPAdapter(max_retries=_RETRIES, pool_connections=10, pool_maxsize=20))
_SESSION.mount("http://", HTTPAdapter(max_retries=_RETRIES, pool_connections=10, pool_maxsize=20))

WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


class WeatherProviderError(Exception):
    """Raised when weather API requests fail."""
    pass


class OpenMeteoWeatherService:
    """Client for Open-Meteo hourly weather forecasting."""

    def __init__(self, timeout: float = 8.0):
        self.timeout = timeout

    def fetch_forecast_for_point(self, coord: Coordinate, target_time: datetime) -> Dict[str, Any]:
        """
        Fetches hourly weather data for the given coordinate.
        Caches responses by coordinate bucket (0.05 degree ~ 3 miles) to prevent duplicate queries.
        """
        lat_bucket = round(coord.latitude, 2)
        lon_bucket = round(coord.longitude, 2)
        date_key = target_time.strftime("%Y-%m-%d")
        cache_key = (lat_bucket, lon_bucket, date_key)

        if cache_key in _WEATHER_CACHE:
            return _WEATHER_CACHE[cache_key]

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": f"{coord.latitude:.4f}",
            "longitude": f"{coord.longitude:.4f}",
            "hourly": "wind_speed_10m,precipitation,rain,snowfall,weather_code,temperature_2m",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "temperature_unit": "fahrenheit",
            "timezone": "UTC",
            "forecast_days": 3,
        }

        try:
            resp = _SESSION.get(url, params=params, timeout=self.timeout)
            if resp.status_code != 200:
                raise WeatherProviderError(f"Open-Meteo returned HTTP {resp.status_code}: {resp.text[:200]}")
            data = resp.json()
            _WEATHER_CACHE[cache_key] = data
            return data
        except requests.RequestException as exc:
            logger.error("Failed to fetch weather for (%.4f, %.4f): %s", coord.latitude, coord.longitude, exc)
            raise WeatherProviderError(f"Network error querying weather provider: {exc}")

    def get_observation_at_time(self, coord: Coordinate, arrival_time: datetime) -> WeatherObservation:
        """
        Retrieves weather observation aligned with the estimated arrival time.
        Converts arrival_time to UTC, finds the nearest forecast hour, and extracts values.
        """
        # Ensure UTC datetime
        if arrival_time.tzinfo is None:
            utc_time = arrival_time.replace(tzinfo=timezone.utc)
        else:
            utc_time = arrival_time.astimezone(timezone.utc)

        now_utc = datetime.now(timezone.utc)
        # Check forecast horizon: Open-Meteo supports past 0 hours to ~7 days ahead
        if utc_time < (now_utc - timedelta(hours=3)):
            return WeatherObservation(
                wind_speed_mph=None,
                rainfall_in_hr=None,
                snowfall_in_hr=None,
                condition_description="Requested departure time is in the past.",
                forecast_time=utc_time,
                is_available=False,
            )

        if utc_time > (now_utc + timedelta(days=7)):
            return WeatherObservation(
                wind_speed_mph=None,
                rainfall_in_hr=None,
                snowfall_in_hr=None,
                condition_description="Estimated arrival is beyond supported 7-day forecast horizon.",
                forecast_time=utc_time,
                is_available=False,
            )

        try:
            payload = self.fetch_forecast_for_point(coord, utc_time)
            hourly = payload.get("hourly", {})
            times = hourly.get("time", [])

            if not times:
                return WeatherObservation(
                    wind_speed_mph=None,
                    rainfall_in_hr=None,
                    snowfall_in_hr=None,
                    condition_description="No forecast series returned by provider.",
                    forecast_time=utc_time,
                    is_available=False,
                )

            # Match nearest hourly index
            # times are formatted "YYYY-MM-DDTHH:00"
            target_str = utc_time.strftime("%Y-%m-%dT%H:00")
            best_idx = 0
            if target_str in times:
                best_idx = times.index(target_str)
            else:
                # Find closest timestamp
                best_diff = timedelta(days=999)
                target_dt = utc_time.replace(minute=0, second=0, microsecond=0)
                for idx, t_str in enumerate(times):
                    parsed_t = datetime.fromisoformat(t_str).replace(tzinfo=timezone.utc)
                    diff = abs(parsed_t - target_dt)
                    if diff < best_diff:
                        best_diff = diff
                        best_idx = idx

            # Extract metric values
            winds = hourly.get("wind_speed_10m", [])
            rains = hourly.get("rain", [])
            precips = hourly.get("precipitation", [])
            snows = hourly.get("snowfall", [])
            temps = hourly.get("temperature_2m", [])
            codes = hourly.get("weather_code", [])

            wind_mph = float(winds[best_idx]) if best_idx < len(winds) and winds[best_idx] is not None else None
            # Use rain if given, otherwise precipitation
            rain_in = (
                float(rains[best_idx]) if best_idx < len(rains) and rains[best_idx] is not None
                else (float(precips[best_idx]) if best_idx < len(precips) and precips[best_idx] is not None else None)
            )
            snow_in = float(snows[best_idx]) if best_idx < len(snows) and snows[best_idx] is not None else None
            temp_f = float(temps[best_idx]) if best_idx < len(temps) and temps[best_idx] is not None else None
            w_code = int(codes[best_idx]) if best_idx < len(codes) and codes[best_idx] is not None else None
            condition_desc = WMO_WEATHER_CODES.get(w_code, "Partly cloudy" if w_code is None else f"Code {w_code}")

            matched_time_str = times[best_idx]
            matched_time = datetime.fromisoformat(matched_time_str).replace(tzinfo=timezone.utc)

            return WeatherObservation(
                wind_speed_mph=wind_mph,
                rainfall_in_hr=rain_in,
                snowfall_in_hr=snow_in,
                temperature_f=temp_f,
                weather_code=w_code,
                condition_description=condition_desc,
                forecast_time=matched_time,
                is_available=True,
            )

        except Exception as exc:
            logger.warning("Error resolving weather observation: %s", exc)
            return WeatherObservation(
                wind_speed_mph=None,
                rainfall_in_hr=None,
                snowfall_in_hr=None,
                condition_description=f"Weather forecast error: {exc}",
                forecast_time=utc_time,
                is_available=False,
            )
