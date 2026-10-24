import { isWoWorkStarted } from './machineWorkState';

// Factory-floor map rules. A machine is on the map while it has an open
// breakdown, or a work order whose work has started — it appears when the work
// starts (not when the WO is merely created) and stays until the WO is signed
// off and closed. Machines that are running normally are never shown.
export const FLOOR_WO_STARTED = isWoWorkStarted;

/** Open breakdown ticket — always red. */
export const FLOOR_BREAKDOWN_COLOR = '#EF4444';

/** One colour per work-order type (none red, none green: red is a breakdown
 *  ticket and green would read as "running"). */
export const FLOOR_WO_TYPE_COLORS: Record<string, string> = {
  BREAKDOWN: '#F97316',
  CORRECTIVE: '#F59E0B',
  PREVENTIVE: '#06B6D4',
  INSTALLATION: '#8B5CF6',
  MODIFICATION: '#EC4899',
  INSPECTION: '#3B82F6',
  CONTRACTOR: '#14B8A6',
  OTHER: '#94A3B8',
};

const TYPE_ORDER = Object.keys(FLOOR_WO_TYPE_COLORS);

export function floorWoTypeColor(woType: string | undefined | null): string {
  return FLOOR_WO_TYPE_COLORS[String(woType ?? '')] ?? FLOOR_WO_TYPE_COLORS.OTHER;
}

/** The type that colours the tile when a machine has several started WOs:
 *  the one that comes first in TYPE_ORDER (most urgent kind of work first). */
export function dominantWoType(woTypes: string[]): string {
  const known = woTypes.filter((t) => t in FLOOR_WO_TYPE_COLORS);
  if (known.length === 0) return 'OTHER';
  return [...known].sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b))[0];
}
