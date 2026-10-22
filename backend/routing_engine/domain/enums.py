"""Domain enums for risk levels and weather conditions."""

from enum import Enum, IntEnum


class RiskLevel(str, Enum):
    """
    Standard risk classification levels for route checkpoints and segments.
    Ordered by severity: LOW < MODERATE < HIGH < SEVERE < NO_TRAVEL.
    """
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    SEVERE = "SEVERE"
    NO_TRAVEL = "NO_TRAVEL"
    UNKNOWN = "UNKNOWN"

    @property
    def severity_rank(self) -> int:
        """Numeric ordering for comparing hazard severities."""
        ranks = {
            RiskLevel.UNKNOWN: 0,
            RiskLevel.LOW: 1,
            RiskLevel.MODERATE: 2,
            RiskLevel.HIGH: 3,
            RiskLevel.SEVERE: 4,
            RiskLevel.NO_TRAVEL: 5,
        }
        return ranks[self]

    @property
    def score_value(self) -> float:
        """
        Continuous numerical scale used for computing distance-weighted average risk.
        No Travel is assigned the highest severity (5.0).
        """
        scores = {
            RiskLevel.UNKNOWN: 2.5,  # Penalty for missing data
            RiskLevel.LOW: 1.0,
            RiskLevel.MODERATE: 2.0,
            RiskLevel.HIGH: 3.0,
            RiskLevel.SEVERE: 4.0,
            RiskLevel.NO_TRAVEL: 5.0,
        }
        return scores[self]

    def __ge__(self, other: "RiskLevel") -> bool:
        if not isinstance(other, RiskLevel):
            return NotImplemented
        return self.severity_rank >= other.severity_rank

    def __gt__(self, other: "RiskLevel") -> bool:
        if not isinstance(other, RiskLevel):
            return NotImplemented
        return self.severity_rank > other.severity_rank

    def __le__(self, other: "RiskLevel") -> bool:
        if not isinstance(other, RiskLevel):
            return NotImplemented
        return self.severity_rank <= other.severity_rank

    def __lt__(self, other: "RiskLevel") -> bool:
        if not isinstance(other, RiskLevel):
            return NotImplemented
        return self.severity_rank < other.severity_rank


class RecommendationStatus(str, Enum):
    """Overall status of route recommendation evaluation."""
    RECOMMENDED = "RECOMMENDED"
    ALL_ROUTES_UNSAFE = "ALL_ROUTES_UNSAFE"
    NO_ROUTES_FOUND = "NO_ROUTES_FOUND"
    DATA_UNAVAILABLE = "DATA_UNAVAILABLE"
