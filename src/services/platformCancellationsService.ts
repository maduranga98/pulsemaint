import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, type Unsubscribe } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

/** platformCancellations: subscription cancellations and requests to leave FirmiCore (written by Cloud Functions). */
export interface PlatformCancellation {
  id: string;
  companyId: string;
  companyName: string | null;
  kind: 'cancel_subscription' | 'leave_system';
  reason: string | null;
  details: string;
  source: 'app' | 'stripe_portal' | string;
  reasonPending: boolean;
  plan: string | null;
  billingCycle: string | null;
  hadSubscription: boolean;
  endsAt: number | null;
  requestedByEmail: string | null;
  requestedByName: string | null;
  status: 'open' | 'handled';
  handledNote: string;
  createdAt: number | null;
}

const col = collection(db, 'platformCancellations');
const ms = (v: unknown): number | null => (v && typeof (v as { toMillis?: () => number }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

export function subscribeCancellations(cb: (rows: PlatformCancellation[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(col, (snap) => cb(snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id, companyId: x.companyId, companyName: x.companyName ?? null, kind: x.kind === 'leave_system' ? 'leave_system' : 'cancel_subscription',
      reason: x.reason ?? null, details: x.details ?? '', source: x.source ?? 'app', reasonPending: x.reasonPending === true,
      plan: x.plan ?? null, billingCycle: x.billingCycle ?? null, hadSubscription: x.hadSubscription === true, endsAt: ms(x.endsAt),
      requestedByEmail: x.requestedByEmail ?? null, requestedByName: x.requestedByName ?? null,
      status: x.status === 'handled' ? 'handled' : 'open', handledNote: x.handledNote ?? '', createdAt: ms(x.createdAt),
    } satisfies PlatformCancellation;
  }).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))), onError);
}

export function subscribeOpenCancellationCount(cb: (n: number) => void): Unsubscribe {
  return onSnapshot(query(col, where('status', '==', 'open')), (snap) => cb(snap.size), () => cb(0));
}

export function setCancellationHandled(id: string, handled: boolean, note = ''): Promise<void> {
  return updateDoc(doc(col, id), {
    status: handled ? 'handled' : 'open', handledNote: note.slice(0, 2000), handledAt: handled ? serverTimestamp() : null, handledBy: handled ? auth.currentUser?.email ?? null : null,
  });
}
