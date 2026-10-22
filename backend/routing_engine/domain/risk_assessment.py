"""
Risk Assessment Engine

Implements strict domain rules for weather hazard classification and cargo-weight overrides.
Pure domain logic: completely decoupled from I/O, external network calls, and databases.
"""

from typing import Optional, Tuple
from routing_engine.domain.enums import RiskLevel
from routing_engine.domain.models import WeatherObservation, CheckpointRisk


def classify_wind_risk(wind_speed_mph: Optional[float]) -> RiskLevel:
    """
    Classifies baseline wind hazard according to exact boundary specifications:
    - Low: below 25 mph (< 25.0)
    - Moderate: 25 to below 35 mph (25.0 <= v < 35.0)
    - High: 35 to below 45 mph (35.0 <= v < 45.0)
    - Severe: 45 to below 55 mph (45.0 <= v < 55.0)
    - No Travel: 55 mph or greater (v >= 55.0)
    """
    if wind_speed_mph is None:
        return RiskLevel.UNKNOWN

    if wind_speed_mph < 25.0:
        return RiskLevel.LOW
    elif wind_speed_mph < 35.0:
        return RiskLevel.MODERATE
    elif wind_speed_mph < 45.0:
        return RiskLevel.HIGH
    elif wind_speed_mph < 55.0:
        return RiskLevel.SEVERE
    else:
        return RiskLevel.NO_TRAVEL


def classify_rainfall_risk(rainfall_in_hr: Optional[float]) -> RiskLevel:
    """
    Classifies rainfall hazard intensity according to exact boundary specifications:
    - Low: below 0.10 in/hr (< 0.10)
    - Moderate: 0.10 to below 0.25 in/hr (0.10 <= r < 0.25)
    - High: 0.25 to below 0.50 in/hr (0.25 <= r < 0.50)
    - Severe: 0.50 to 1.00 in/hr, inclusive (0.50 <= r <= 1.00)
    - No Travel: above 1.00 in/hr (r > 1.00)
    """
    if rainfall_in_hr is None:
        return RiskLevel.UNKNOWN

    if rainfall_in_hr < 0.10:
        return RiskLevel.LOW
    elif rainfall_in_hr < 0.25:
        return RiskLevel.MODERATE
    elif rainfall_in_hr < 0.50:
        return RiskLevel.HIGH
    elif rainfall_in_hr <= 1.00:  # 0.50 to 1.00 INCLUSIVE
        return RiskLevel.SEVERE
    else:  # strictly above 1.00
        return RiskLevel.NO_TRAVEL


def classify_snowfall_risk(snowfall_in_hr: Optional[float]) -> RiskLevel:
    """
    Classifies snowfall hazard intensity according to exact boundary specifications:
    - Low: below 0.5 in/hr (< 0.5)
    - Moderate: 0.5 to below 1.0 in/hr (0.5 <= s < 1.0)
    - High: 1.0 to below 2.0 in/hr (1.0 <= s < 2.0)
    - Severe: 2.0 to 3.0 in/hr, inclusive (2.0 <= s <= 3.0)
    - No Travel: above 3.0 in/hr (s > 3.0)
    """
    if snowfall_in_hr is None:
        return RiskLevel.UNKNOWN

    if snowfall_in_hr < 0.5:
        return RiskLevel.LOW
    elif snowfall_in_hr < 1.0:
        return RiskLevel.MODERATE
    elif snowfall_in_hr < 2.0:
        return RiskLevel.HIGH
    elif snowfall_in_hr <= 3.0:  # 2.0 to 3.0 INCLUSIVE
        return RiskLevel.SEVERE
    else:  # strictly above 3.0
        return RiskLevel.NO_TRAVEL


def apply_cargo_weight_override(
    wind_speed_mph: Optional[float],
    cargo_weight_lbs: float,
    baseline_wind_risk: RiskLevel,
) -> Tuple[RiskLevel, bool, Optional[str]]:
    """
    Applies cargo-weight wind overrides according to exact specifications:
    1. Wind speed of at least 55 mph results in No Travel for every load.
    2. Wind speed from 45 mph up to, but not including, 55 mph results in No Travel
       when cargo weight is strictly greater than 30,000 lb.
    3. Wind speed from 35 mph up to, but not including, 45 mph results in Severe
       when cargo weight is strictly greater than 40,000 lb.

    Returns:
        (adjusted_wind_risk, override_applied, reason_string)
    """
    if wind_speed_mph is None:
        return RiskLevel.UNKNOWN, False, None

    # Condition 1: Wind >= 55.0 mph -> No Travel for all loads
    if wind_speed_mph >= 55.0:
        return RiskLevel.NO_TRAVEL, False, "Extreme wind (>= 55 mph) enforces No Travel for all vehicle loads."

    # Condition 2: 45.0 <= wind < 55.0 mph
    if 45.0 <= wind_speed_mph < 55.0:
        if cargo_weight_lbs > 30000.0:
            return (
                RiskLevel.NO_TRAVEL,
                True,
                f"Cargo weight of {cargo_weight_lbs:,.0f} lbs (> 30,000 lbs) in 45-55 mph wind triggers No Travel override (severe rollover risk).",
            )
        return RiskLevel.SEVERE, False, None

    # Condition 3: 35.0 <= wind < 45.0 mph
    if 35.0 <= wind_speed_mph < 45.0:
        if cargo_weight_lbs > 40000.0:
            return (
                RiskLevel.SEVERE,
                True,
                f"Cargo weight of {cargo_weight_lbs:,.0f} lbs (> 40,000 lbs) in 35-45 mph wind triggers Severe risk override.",
            )
        return RiskLevel.HIGH, False, None

    return baseline_wind_risk, False, None


def assess_checkpoint_risk(
    weather: WeatherObservation,
    cargo_weight_lbs: float,
) -> CheckpointRisk:
    """
    Evaluates individual weather hazards and cargo-weight overrides for a checkpoint.
    The overall checkpoint risk reflects the most restrictive applicable classification.
    Multiple weather hazards take the maximum risk.
    Unknown weather measurements are flagged as UNKNOWN and never defaulted to Low.
    """
    if not weather.is_available:
        return CheckpointRisk(
            overall_risk=RiskLevel.UNKNOWN,
            wind_risk=RiskLevel.UNKNOWN,
            rain_risk=RiskLevel.UNKNOWN,
            snow_risk=RiskLevel.UNKNOWN,
            weight_override_applied=False,
            override_reason="Weather forecast unavailable for checkpoint timestamp and location.",
        )

    # 1. Base weather hazard evaluations
    raw_wind_risk = classify_wind_risk(weather.wind_speed_mph)
    rain_risk = classify_rainfall_risk(weather.rainfall_in_hr)
    snow_risk = classify_snowfall_risk(weather.snowfall_in_hr)

    # 2. Cargo weight override on wind
    effective_wind_risk, override_applied, override_reason = apply_cargo_weight_override(
        weather.wind_speed_mph, cargo_weight_lbs, raw_wind_risk
    )

    # 3. Overall risk = highest severity among applicable hazards
    evaluated_risks = [effective_wind_risk, rain_risk, snow_risk]
    
    # If any is NO_TRAVEL, overall is NO_TRAVEL
    if RiskLevel.NO_TRAVEL in evaluated_risks:
        overall_risk = RiskLevel.NO_TRAVEL
    elif RiskLevel.SEVERE in evaluated_risks:
        overall_risk = RiskLevel.SEVERE
    elif RiskLevel.HIGH in evaluated_risks:
        overall_risk = RiskLevel.HIGH
    elif RiskLevel.MODERATE in evaluated_risks:
        overall_risk = RiskLevel.MODERATE
    elif RiskLevel.UNKNOWN in evaluated_risks:
        # If all known are LOW or none known, preserve UNKNOWN rather than pretending LOW
        known_risks = [r for r in evaluated_risks if r != RiskLevel.UNKNOWN]
        if known_risks:
            overall_risk = max(known_risks, key=lambda r: r.severity_rank)
        else:
            overall_risk = RiskLevel.UNKNOWN
    else:
        overall_risk = RiskLevel.LOW

    return CheckpointRisk(
        overall_risk=overall_risk,
        wind_risk=effective_wind_risk,
        rain_risk=rain_risk,
        snow_risk=snow_risk,
        weight_override_applied=override_applied,
        override_reason=override_reason,
        details={
            "raw_wind_risk": raw_wind_risk.value,
            "wind_speed_mph": weather.wind_speed_mph,
            "rainfall_in_hr": weather.rainfall_in_hr,
            "snowfall_in_hr": weather.snowfall_in_hr,
            "cargo_weight_lbs": cargo_weight_lbs,
        },
    )
