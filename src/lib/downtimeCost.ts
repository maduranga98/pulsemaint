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

/**
 * A machine's total downtime and what it cost: the downtime events (see
 * lib/machineDowntime — the same ones the dashboards sum) times the machine's
 * own Downtime Cost rate from its profile (direct per-hour cost, or
 * units/hour × value/unit). `cost` is null when the machine has no rate set.
 */
export function machineDowntimeCost(
  events: { hours: number }[],
  machine: { costPerHourDown?: number | null; unitsPerHour?: number | null; unitValue?: number | null },
): { hours: number; rate: number | null; cost: number | null } {
  const hours = events.reduce((sum, e) => sum + e.hours, 0);
  const rate = computeEffectiveCostPerHour(
    machine.costPerHourDown ?? null,
    machine.unitsPerHour ?? null,
    machine.unitValue ?? null,
  );
  return { hours, rate, cost: rate === null ? null : hours * rate };
}
