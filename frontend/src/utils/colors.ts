import type { RiskLevel } from "../types";

export function getRiskColor(risk: RiskLevel): string {
  switch (risk) {
    case "LOW":
      return "#10b981"; // Emerald
    case "MODERATE":
      return "#f59e0b"; // Amber
    case "HIGH":
      return "#f97316"; // Orange
    case "SEVERE":
      return "#ef4444"; // Red
    case "NO_TRAVEL":
      return "#7f1d1d"; // Deep Maroon
    default:
      return "#6b7280"; // Gray
  }
}
