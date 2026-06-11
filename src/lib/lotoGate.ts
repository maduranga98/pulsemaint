import type { Permit } from '../types/permit';

export function computeLotoGatePassed(
  permit: Pick<Permit, 'isolationChecklist' | 'zeroEnergyVerified' | 'status'> | null,
  ptwCategory: string | null,
): boolean {
  if (!permit) return false;
  const allLocked =
    permit.isolationChecklist.length > 0 &&
    permit.isolationChecklist.every((e) => e.locked);
  if (!allLocked) return false;
  if (!permit.zeroEnergyVerified) return false;
  if (ptwCategory && permit.status !== 'active') return false;
  return true;
}

export function computeChecklistItemResult(
  value: number | null,
  min: number | null,
  max: number | null,
): 'pass' | 'fail' | null {
  if (value === null || min === null || max === null) return null;
  return value >= min && value <= max ? 'pass' : 'fail';
}
