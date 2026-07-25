import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { categoryPrefixLetter, formatCategoryPartNumber } from './inventoryTypes';

/**
 * Returns the next auto-generated part number for a category (e.g.
 * "E000001" for Electrical).
 *
 * Deliberately queries `inventoryParts` directly (a single companyId
 * equality filter — no composite index required, and the exact same
 * collection/rules every part read already uses) rather than a separate
 * counter collection: a dedicated counter doc needs its own Firestore rules
 * deployed before it works, and until that deploy lands every part creation
 * fails with "Missing or insufficient permissions". Reading existing parts
 * needs no new permissions at all.
 */
export async function getNextCategoryPartNumber(
  companyId: string,
  category: string,
): Promise<string> {
  const prefixLetter = categoryPrefixLetter(category);

  const snap = await getDocs(
    query(collection(db, 'inventoryParts'), where('companyId', '==', companyId)),
  );

  let maxSeq = 0;
  snap.forEach((d) => {
    const partNumber = String(d.data().partNumber ?? '');
    if (!partNumber.startsWith(prefixLetter)) return;
    const match = partNumber.slice(prefixLetter.length).match(/^(\d+)$/);
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  });

  return formatCategoryPartNumber(prefixLetter, maxSeq + 1);
}
