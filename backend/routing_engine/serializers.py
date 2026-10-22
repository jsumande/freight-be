"""
Serializers for Route Calculation and Forecast Timeline Endpoints
"""

from datetime import datetime, timezone, timedelta
from rest_framework import serializers


class RouteCalculationRequestSerializer(serializers.Serializer):
    origin = serializers.CharField(
        max_length=255,
        required=True,
        allow_blank=False,
        help_text="Origin address, city, or coordinate (e.g. 'Chicago, IL' or '41.8781, -87.6298')",
    )
    destination = serializers.CharField(
        max_length=255,
        required=True,
        allow_blank=False,
        help_text="Destination address, city, or coordinate (e.g. 'Denver, CO')",
    )
    departure_time = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="ISO-8601 departure datetime. Defaults to current time if omitted.",
    )
    cargo_weight_lbs = serializers.FloatField(
        required=True,
        min_value=0.0,
        max_value=120000.0,
        help_text="Commercial freight cargo weight in pounds (0 to 120,000 lbs).",
    )
    checkpoint_interval_miles = serializers.FloatField(
        default=25.0,
        required=False,
        help_text="Sampling distance interval for weather evaluation (10, 25, or 50 miles).",
    )

    def validate_checkpoint_interval_miles(self, value):
        val = float(value)
        if val not in (10.0, 25.0, 50.0):
            raise serializers.ValidationError("Checkpoint interval must be one of: 10, 25, or 50 miles.")
        return val

    def validate_departure_time(self, value):
        if value is None:
            return datetime.now(timezone.utc)
        # Verify not excessively in the past (e.g. > 24 hours ago)
        now_utc = datetime.now(timezone.utc)
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        if value < (now_utc - timedelta(hours=24)):
            raise serializers.ValidationError("Departure time cannot be more than 24 hours in the past.")
        if value > (now_utc + timedelta(days=7)):
            raise serializers.ValidationError("Departure time cannot be more than 7 days in the future.")
        return value


class TimelineReevaluationRequestSerializer(serializers.Serializer):
    offset_hours = serializers.IntegerField(
        min_value=0,
        max_value=48,
        required=True,
        help_text="Forecast slider offset in hours (0 to 48).",
    )
    cargo_weight_lbs = serializers.FloatField(
        min_value=0.0,
        max_value=120000.0,
        required=True,
    )
    checkpoints = serializers.ListField(
        child=serializers.DictField(),
        required=True,
        allow_empty=False,
        help_text="List of checkpoints with coordinates and cumulative miles to re-evaluate.",
    )
    total_distance_miles = serializers.FloatField(
        min_value=0.1,
        required=True,
    )
