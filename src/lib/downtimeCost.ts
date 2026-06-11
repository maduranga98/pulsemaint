export function computeEffectiveCostPerHour(
  costPerHourDown: number | null,
  unitsPerHour: number | null,
  unitValue: number | null,
): number | null {
  if (costPerHourDown !== null) return costPerHourDown;
  if (unitsPerHour !== null && unitValue !== null) return unitsPerHour * unitValue;
  return null;
}

export function computeDowntimeCost(
  downtimeHours: number,
  costPerHourDown: number | null,
  unitsPerHour: number | null,
  unitValue: number | null,
): number | null {
  const rate = computeEffectiveCostPerHour(costPerHourDown, unitsPerHour, unitValue);
  if (rate === null) return null;
  return downtimeHours * rate;
}

export function formatDowntimeCost(
  downtimeHours: number,
  rate: number,
  currency: string,
): string {
  const cost = downtimeHours * rate;
  return `${downtimeHours.toFixed(1)}h × ${currency} ${rate.toLocaleString()}/h = ${currency} ${Math.round(cost).toLocaleString()}`;
}
