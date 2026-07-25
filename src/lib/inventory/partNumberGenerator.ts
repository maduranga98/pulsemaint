import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { categoryPrefixLetter, formatCategoryPartNumber } from './inventoryTypes';

/**
 * Reads every part number for the company and returns the highest sequence
 * number seen per category-letter prefix (e.g. { E: 12, M: 4 }).
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

  const maxSeqByPrefix = new Map<string, number>();
  snap.forEach((d) => {
    const partNumber = String(d.data().partNumber ?? '');
    const match = partNumber.match(/^([A-Za-z])(\d+)$/);
    if (!match) return;
    const [, letter, digits] = match;
    const seq = parseInt(digits, 10);
    maxSeqByPrefix.set(letter, Math.max(maxSeqByPrefix.get(letter) ?? 0, seq));
  });
  return maxSeqByPrefix;
}

/** Next number for a single category, e.g. from the Add Part form. */
export async function getNextCategoryPartNumber(
  companyId: string,
  category: string,
): Promise<string> {
  const prefixLetter = categoryPrefixLetter(category);
  const maxSeqByPrefix = await getCategorySequenceMap(companyId);
  return formatCategoryPartNumber(prefixLetter, (maxSeqByPrefix.get(prefixLetter) ?? 0) + 1);
}

/**
 * Assigns sequential category-based part numbers to many rows in one pass
 * (e.g. an Excel import), without re-querying per row — callers reserve
 * numbers from an in-memory counter seeded once from getCategorySequenceMap.
 */
export function nextFromCounter(
  counters: Map<string, number>,
  category: string,
): string {
  const prefixLetter = categoryPrefixLetter(category);
  const next = (counters.get(prefixLetter) ?? 0) + 1;
  counters.set(prefixLetter, next);
  return formatCategoryPartNumber(prefixLetter, next);
}
