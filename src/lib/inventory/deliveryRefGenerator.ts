import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PurchaseOrder } from '@/types/inventory';

// "DN-2026-000007" — auto-generated so store keepers never have to invent
// their own delivery reference. Sequence is derived by counting every
// receiptHistory entry across the company's purchase orders (deliberately
// queried directly rather than a separate counter collection — a dedicated
// counter doc needs its own Firestore rules deployed before it works, same
// reasoning as the part-number/supplier-code generators).
export function formatDeliveryRef(sequence: number): string {
  const year = new Date().getFullYear();
  return `DN-${year}-${String(sequence).padStart(6, '0')}`;
}

export async function getNextDeliveryRefSequence(companyId: string): Promise<number> {
  const snap = await getDocs(query(collection(db, 'purchaseOrders'), where('companyId', '==', companyId)));
  const totalReceipts = snap.docs.reduce((sum, d) => {
    const po = d.data() as PurchaseOrder;
    return sum + (po.receiptHistory?.length ?? 0);
  }, 0);
  return totalReceipts + 1;
}

export async function getNextDeliveryRef(companyId: string): Promise<string> {
  const sequence = await getNextDeliveryRefSequence(companyId);
  return formatDeliveryRef(sequence);
}
