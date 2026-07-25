import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Two-letter-ish country code slug used in supplier codes, e.g. "Sri Lanka" -> "LK" if given as a code, else first 2 letters. */
function countryCode(country: string): string {
  const trimmed = country.trim();
  if (!trimmed) return 'XX';
  // Already a short code (e.g. "LK", "US")
  if (/^[A-Za-z]{2,3}$/.test(trimmed)) return trimmed.toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

/** "SUP-LK-000001" — country + a unique, sequential number, auto-assigned to every supplier. */
export function formatSupplierCode(country: string, sequence: number): string {
  return `SUP-${countryCode(country)}-${String(sequence).padStart(6, '0')}`;
}

/**
 * Highest existing supplier code sequence number for the company, scoped to
 * a specific country prefix so numbering per country stays sequential.
 * Queries `suppliers` directly (single companyId equality filter, same
 * collection/rules every supplier read already uses) rather than a
 * separate counter doc, for the same reason part numbers do: no new
 * collection/rules to deploy.
 */
export async function getSupplierCodeSequenceMap(companyId: string): Promise<Map<string, number>> {
  const snap = await getDocs(
    query(collection(db, 'suppliers'), where('companyId', '==', companyId)),
  );

  const maxSeqByCountry = new Map<string, number>();
  snap.forEach((d) => {
    const match = String(d.data().supplierCode ?? '').match(/^SUP-([A-Za-z]{2,3})-(\d+)$/);
    if (!match) return;
    const [, code, digits] = match;
    maxSeqByCountry.set(code, Math.max(maxSeqByCountry.get(code) ?? 0, parseInt(digits, 10)));
  });
  return maxSeqByCountry;
}

/** Next single supplier code, e.g. for the "Add Supplier" form. */
export async function getNextSupplierCode(companyId: string, country: string): Promise<string> {
  const maxSeqByCountry = await getSupplierCodeSequenceMap(companyId);
  const code = countryCode(country);
  return formatSupplierCode(country, (maxSeqByCountry.get(code) ?? 0) + 1);
}

/**
 * Assigns sequential supplier codes to many new suppliers in one pass (e.g.
 * a CSV/Excel import) without re-querying per row.
 */
export function nextSupplierCodeFromCounter(counters: Map<string, number>, country: string): string {
  const code = countryCode(country);
  const next = (counters.get(code) ?? 0) + 1;
  counters.set(code, next);
  return formatSupplierCode(country, next);
}
