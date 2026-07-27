/**
 * Shared MOE (Machine Overall Effectiveness) calculation helpers used by the
 * scheduled/trigger Cloud Functions in this directory. Mirrors the pure math
 * in src/modules/moe/services/moe.service.ts on the client so both sides
 * agree on the formula.
 */

const DEFAULT_WEIGHTS = {
  availability: 0.35,
  maintenanceCompliance: 0.25,
  reliability: 0.25,
  health: 0.15,
};

const DEFAULT_CONFIG = {
  weights: DEFAULT_WEIGHTS,
  reliabilityPenaltyFactor: 8,
  criticalMoeThreshold: 70,
  statusBands: { excellent: 85, good: 70, atRisk: 50 },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function calculateAvailabilityScore(periodMinutes, downtimeMinutes) {
  if (periodMinutes <= 0) return 100;
  return round1(clamp(((periodMinutes - downtimeMinutes) / periodMinutes) * 100, 0, 100));
}

function calculateReliabilityScore(breakdownCount, penaltyFactor) {
  return round1(clamp(100 - breakdownCount * penaltyFactor, 0, 100));
}

function calculateMaintenanceComplianceScore(scheduledCount, onTimeCount) {
  if (scheduledCount <= 0) return 100;
  return round1(clamp((onTimeCount / scheduledCount) * 100, 0, 100));
}

function calculateMoeScore(scores, weights) {
  const val =
    scores.availabilityScore * weights.availability +
    scores.maintenanceComplianceScore * weights.maintenanceCompliance +
    scores.reliabilityScore * weights.reliability +
    scores.healthScore * weights.health;
  return round1(clamp(val, 0, 100));
}

module.exports = {
  DEFAULT_WEIGHTS,
  DEFAULT_CONFIG,
  calculateAvailabilityScore,
  calculateReliabilityScore,
  calculateMaintenanceComplianceScore,
  calculateMoeScore,
};
