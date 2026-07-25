import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCategoryPartNumber, partNumberSequenceKey, type PartNumberFactors } from './inventoryTypes';

/**
 * Reads every part number for the company and returns the highest sequence
 * number seen per (category, supplier, location) key — see
 * inventoryTypes.ts's partNumberSequenceKey/formatCategoryPartNumber.
 *
 * Deliberately queries `inventoryParts` directly (a single companyId
 * equality filter — no composite index required, and the exact same
 * collection/rules every part read already uses) rather than a separate
 * counter collection: a dedicated counter doc needs its own Firestore rules
 * deployed before it works, and until that deploy lands every part creation
 * fails with "Missing or insufficient permissions". Reading existing parts
 * needs no new permissions at all.
 */
export async function getCategorySequenceMap(companyId: string): Promise<Map<string, number>> {
  const snap = await getDocs(
    query(collection(db, 'inventoryParts'), where('companyId', '==', companyId)),
  );

  const maxSeqByKey = new Map<string, number>();
  snap.forEach((d) => {
    const partNumber = String(d.data().partNumber ?? '');
    const match = partNumber.match(/^([A-Za-z]+)-([A-Za-z0-9]+)-([A-Za-z0-9]+)-(\d+)$/);
    if (!match) return;
    const [, cat, sup, loc, digits] = match;
    const key = `${cat}-${sup}-${loc}`;
    maxSeqByKey.set(key, Math.max(maxSeqByKey.get(key) ?? 0, parseInt(digits, 10)));
  });
  return maxSeqByKey;
}

/** Next number for a single (category, supplier, location) combo, e.g. from the Add Part form. */
export async function getNextCategoryPartNumber(
  companyId: string,
  factors: PartNumberFactors,
): Promise<string> {
  const maxSeqByKey = await getCategorySequenceMap(companyId);
  const key = partNumberSequenceKey(factors);
  return formatCategoryPartNumber(factors, (maxSeqByKey.get(key) ?? 0) + 1);
}

/**
 * Assigns sequential part numbers to many rows in one pass (e.g. an Excel
 * import), without re-querying per row — callers reserve numbers from an
 * in-memory counter seeded once from getCategorySequenceMap.
 */
export function nextFromCounter(
  counters: Map<string, number>,
  factors: PartNumberFactors,
): string {
  const key = partNumberSequenceKey(factors);
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  return formatCategoryPartNumber(factors, next);
}
