import type { SafetyCase, SafetyCaseSubjectType } from '@/types/safety';

/** Points at/above which a person or machine is automatically blacklisted from WO assignment. */
export const BLACKLIST_THRESHOLD = 100;

/** The kinds of entity a safety case can accumulate points against. */
export type BlacklistEntityType = Extract<SafetyCaseSubjectType, 'technician' | 'contractor' | 'operator'> | 'machine';

export interface BlacklistResetMap {
  /** Keyed by `${entityType}:${entityId}` — a reset zeroes out points from cases reported before it. */
  [key: string]: number | undefined; // clearedAt in ms
}

export interface BlacklistEntry {
  entityType: BlacklistEntityType;
  entityId: string;
  entityName: string;
  points: number;
  caseCount: number;
  isBlacklisted: boolean;
  lastCaseAt: number | null;
}

export function blacklistKey(entityType: BlacklistEntityType, entityId: string): string {
  return `${entityType}:${entityId}`;
}

/**
 * Aggregates safety-case points per technician/contractor/operator (via
 * `subjectType`/`subjectId`) and per machine (via `machineId`) — a single
 * case can contribute to both a subject and a machine independently. An
 * admin "clear" resets an entity's running total by excluding any case
 * reported before the clear timestamp, rather than mutating historical case
 * records.
 */
export function computeBlacklist(cases: SafetyCase[], resets: BlacklistResetMap = {}): BlacklistEntry[] {
  const map = new Map<string, BlacklistEntry>();

  function add(entityType: BlacklistEntityType, entityId: string | null, entityName: string | null, points: number, caseAtMs: number) {
    if (!entityId) return;
    const key = blacklistKey(entityType, entityId);
    const clearedAt = resets[key] ?? 0;
    if (caseAtMs < clearedAt) return;
    const existing = map.get(key);
    if (existing) {
      existing.points += points;
      existing.caseCount += 1;
      existing.lastCaseAt = Math.max(existing.lastCaseAt ?? 0, caseAtMs);
    } else {
      map.set(key, {
        entityType,
        entityId,
        entityName: entityName ?? 'Unknown',
        points,
        caseCount: 1,
        isBlacklisted: false,
        lastCaseAt: caseAtMs,
      });
    }
  }

  for (const c of cases) {
    const caseAtMs = c.reportedAt?.toDate?.().getTime() ?? 0;
    if (c.subjectType === 'technician' || c.subjectType === 'contractor' || c.subjectType === 'operator') {
      add(c.subjectType, c.subjectId, c.subjectName, c.points, caseAtMs);
    }
    if (c.machineId) {
      add('machine', c.machineId, c.machineName, c.points, caseAtMs);
    }
  }

  for (const entry of map.values()) {
    entry.isBlacklisted = entry.points >= BLACKLIST_THRESHOLD;
  }

  return Array.from(map.values()).sort((a, b) => b.points - a.points);
}
