"""
Unit tests for domain risk assessment logic and exact boundary conditions.
"""

import pytest
from routing_engine.domain.enums import RiskLevel
from routing_engine.domain.models import WeatherObservation
from routing_engine.domain.risk_assessment import (
    classify_wind_risk,
    classify_rainfall_risk,
    classify_snowfall_risk,
    apply_cargo_weight_override,
    assess_checkpoint_risk,
)


class TestWindRiskBoundaries:
    """Tests wind classification against exact boundary specifications."""

    def test_wind_low(self):
        assert classify_wind_risk(0.0) == RiskLevel.LOW
        assert classify_wind_risk(24.9) == RiskLevel.LOW

    def test_wind_moderate(self):
        assert classify_wind_risk(25.0) == RiskLevel.MODERATE
        assert classify_wind_risk(30.0) == RiskLevel.MODERATE
        assert classify_wind_risk(34.99) == RiskLevel.MODERATE

    def test_wind_high(self):
        assert classify_wind_risk(35.0) == RiskLevel.HIGH
        assert classify_wind_risk(40.0) == RiskLevel.HIGH
        assert classify_wind_risk(44.99) == RiskLevel.HIGH

    def test_wind_severe(self):
        assert classify_wind_risk(45.0) == RiskLevel.SEVERE
        assert classify_wind_risk(50.0) == RiskLevel.SEVERE
        assert classify_wind_risk(54.99) == RiskLevel.SEVERE

    def test_wind_no_travel(self):
        assert classify_wind_risk(55.0) == RiskLevel.NO_TRAVEL
        assert classify_wind_risk(75.0) == RiskLevel.NO_TRAVEL

    def test_wind_missing(self):
        assert classify_wind_risk(None) == RiskLevel.UNKNOWN


class TestRainfallRiskBoundaries:
    """Tests rainfall classification against exact boundary specifications."""

    def test_rainfall_low(self):
        assert classify_rainfall_risk(0.0) == RiskLevel.LOW
        assert classify_rainfall_risk(0.09) == RiskLevel.LOW

    def test_rainfall_moderate(self):
        assert classify_rainfall_risk(0.10) == RiskLevel.MODERATE
        assert classify_rainfall_risk(0.249) == RiskLevel.MODERATE

    def test_rainfall_high(self):
        assert classify_rainfall_risk(0.25) == RiskLevel.HIGH
        assert classify_rainfall_risk(0.499) == RiskLevel.HIGH

    def test_rainfall_severe_inclusive(self):
        # 0.50 to 1.00 INCLUSIVE
        assert classify_rainfall_risk(0.50) == RiskLevel.SEVERE
        assert classify_rainfall_risk(0.75) == RiskLevel.SEVERE
        assert classify_rainfall_risk(1.00) == RiskLevel.SEVERE

    def test_rainfall_no_travel(self):
        # Strictly above 1.00
        assert classify_rainfall_risk(1.001) == RiskLevel.NO_TRAVEL
        assert classify_rainfall_risk(2.5) == RiskLevel.NO_TRAVEL

    def test_rainfall_missing(self):
        assert classify_rainfall_risk(None) == RiskLevel.UNKNOWN


class TestSnowfallRiskBoundaries:
    """Tests snowfall classification against exact boundary specifications."""

    def test_snowfall_low(self):
        assert classify_snowfall_risk(0.0) == RiskLevel.LOW
        assert classify_snowfall_risk(0.49) == RiskLevel.LOW

    def test_snowfall_moderate(self):
        assert classify_snowfall_risk(0.50) == RiskLevel.MODERATE
        assert classify_snowfall_risk(0.99) == RiskLevel.MODERATE

    def test_snowfall_high(self):
        assert classify_snowfall_risk(1.00) == RiskLevel.HIGH
        assert classify_snowfall_risk(1.99) == RiskLevel.HIGH

    def test_snowfall_severe_inclusive(self):
        # 2.0 to 3.0 INCLUSIVE
        assert classify_snowfall_risk(2.00) == RiskLevel.SEVERE
        assert classify_snowfall_risk(2.50) == RiskLevel.SEVERE
        assert classify_snowfall_risk(3.00) == RiskLevel.SEVERE

    def test_snowfall_no_travel(self):
        # Strictly above 3.0
        assert classify_snowfall_risk(3.01) == RiskLevel.NO_TRAVEL
        assert classify_snowfall_risk(5.0) == RiskLevel.NO_TRAVEL

    def test_snowfall_missing(self):
        assert classify_snowfall_risk(None) == RiskLevel.UNKNOWN


class TestCargoWeightOverrides:
    """
    Cargo-weight overrides:
    - Wind speed >= 55 mph: No Travel for every load.
    - Wind speed from 45 up to, but not including, 55 mph: No Travel when weight > 30,000 lb.
    - Wind speed from 35 up to, but not including, 45 mph: Severe when weight > 40,000 lb.
    """

    def test_extreme_wind_overrides_all_weights(self):
        for weight in [0, 15000, 30000, 45000, 80000]:
            risk, override, _ = apply_cargo_weight_override(55.0, weight, RiskLevel.NO_TRAVEL)
            assert risk == RiskLevel.NO_TRAVEL

            risk_60, _, _ = apply_cargo_weight_override(60.0, weight, RiskLevel.NO_TRAVEL)
            assert risk_60 == RiskLevel.NO_TRAVEL

    def test_wind_45_to_55_weight_boundary(self):
        # Strictly greater than 30,000 lbs triggers NO TRAVEL
        wind = 48.0
        baseline = RiskLevel.SEVERE

        # Weight <= 30,000 lbs retains SEVERE
        risk, override, reason = apply_cargo_weight_override(wind, 20000, baseline)
        assert risk == RiskLevel.SEVERE
        assert override is False

        risk_exact, override_exact, _ = apply_cargo_weight_override(wind, 30000.0, baseline)
        assert risk_exact == RiskLevel.SEVERE
        assert override_exact is False

        # Weight > 30,000 lbs becomes NO TRAVEL
        risk_over, override_over, reason_over = apply_cargo_weight_override(wind, 30001.0, baseline)
        assert risk_over == RiskLevel.NO_TRAVEL
        assert override_over is True
        assert "30,000 lbs" in reason_over

        risk_heavy, override_heavy, _ = apply_cargo_weight_override(wind, 45000.0, baseline)
        assert risk_heavy == RiskLevel.NO_TRAVEL
        assert override_heavy is True

    def test_wind_35_to_45_weight_boundary(self):
        # Strictly greater than 40,000 lbs triggers SEVERE
        wind = 38.0
        baseline = RiskLevel.HIGH

        # Weight <= 40,000 lbs retains HIGH
        risk, override, _ = apply_cargo_weight_override(wind, 35000, baseline)
        assert risk == RiskLevel.HIGH
        assert override is False

        risk_exact, override_exact, _ = apply_cargo_weight_override(wind, 40000.0, baseline)
        assert risk_exact == RiskLevel.HIGH
        assert override_exact is False

        # Weight > 40,000 lbs becomes SEVERE
        risk_over, override_over, reason_over = apply_cargo_weight_override(wind, 40001.0, baseline)
        assert risk_over == RiskLevel.SEVERE
        assert override_over is True
        assert "40,000 lbs" in reason_over


class TestMultiHazardAndMissingData:
    """Verifies multi-hazard escalation and missing data handling."""

    def test_highest_risk_selected(self):
        # Wind is Moderate (28 mph), Rain is Severe (0.6 in/hr), Snow is Low (0.1 in/hr)
        obs = WeatherObservation(
            wind_speed_mph=28.0,
            rainfall_in_hr=0.6,
            snowfall_in_hr=0.1,
            is_available=True,
        )
        risk = assess_checkpoint_risk(obs, cargo_weight_lbs=20000)
        assert risk.overall_risk == RiskLevel.SEVERE
        assert risk.wind_risk == RiskLevel.MODERATE
        assert risk.rain_risk == RiskLevel.SEVERE
        assert risk.snow_risk == RiskLevel.LOW

    def test_no_travel_hazard_never_averaged_away(self):
        # Rain is extreme (1.5 in/hr -> NO_TRAVEL), wind is mild (5 mph -> LOW)
        obs = WeatherObservation(
            wind_speed_mph=5.0,
            rainfall_in_hr=1.5,
            snowfall_in_hr=0.0,
            is_available=True,
        )
        risk = assess_checkpoint_risk(obs, cargo_weight_lbs=20000)
        assert risk.overall_risk == RiskLevel.NO_TRAVEL

    def test_unavailable_weather_does_not_default_to_low(self):
        obs = WeatherObservation(
            wind_speed_mph=None,
            rainfall_in_hr=None,
            snowfall_in_hr=None,
            is_available=False,
        )
        risk = assess_checkpoint_risk(obs, cargo_weight_lbs=30000)
        assert risk.overall_risk == RiskLevel.UNKNOWN
        assert risk.overall_risk != RiskLevel.LOW
