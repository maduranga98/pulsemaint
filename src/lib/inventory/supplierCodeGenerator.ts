import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** "SUP-000001" — a simple, unique, sequential code auto-assigned to every supplier. */
export function formatSupplierCode(sequence: number): string {
  return `SUP-${String(sequence).padStart(6, '0')}`;
}

/**
 * Highest existing supplier code sequence number for the company. Queries
 * `suppliers` directly (single companyId equality filter, same
 * collection/rules every supplier read already uses) rather than a
 * separate counter doc, for the same reason part numbers do: no new
 * collection/rules to deploy.
 */
export async function getSupplierCodeSequenceStart(companyId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, 'suppliers'), where('companyId', '==', companyId)),
  );

  let maxSeq = 0;
  snap.forEach((d) => {
    const match = String(d.data().supplierCode ?? '').match(/^SUP-(\d+)$/);
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  });
  return maxSeq;
}

/** Next single supplier code, e.g. for the "Add Supplier" form. */
export async function getNextSupplierCode(companyId: string): Promise<string> {
  const maxSeq = await getSupplierCodeSequenceStart(companyId);
  return formatSupplierCode(maxSeq + 1);
}

/**
 * Assigns sequential supplier codes to many new suppliers in one pass (e.g.
 * a CSV import) without re-querying per row.
 */
export function nextSupplierCodeFromCounter(counter: { seq: number }): string {
  counter.seq += 1;
  return formatSupplierCode(counter.seq);
}
