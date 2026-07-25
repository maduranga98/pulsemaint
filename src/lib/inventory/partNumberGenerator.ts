import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { categoryPrefixLetter, formatCategoryPartNumber } from './inventoryTypes';

/**
 * Atomically reserves and returns the next auto-generated part number for a
 * category (e.g. "E000001" for Electrical), using a per-company-per-prefix
 * counter document so concurrent creates never collide — unlike the old
 * "query the highest existing partNumber and +1" approach, which raced
 * under concurrent saves.
 */
export async function getNextCategoryPartNumber(
  companyId: string,
  category: string,
): Promise<string> {
  const prefixLetter = categoryPrefixLetter(category);
  const counterRef = doc(db, 'inventoryCounters', `${companyId}_${prefixLetter}`);

  const nextSeq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? Number(snap.data().seq ?? 0) : 0;
    const next = current + 1;
    tx.set(counterRef, { companyId, prefixLetter, seq: next }, { merge: true });
    return next;
  });

  return formatCategoryPartNumber(prefixLetter, nextSeq);
}
