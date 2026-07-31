import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { isWorkPermitOverdue } from '@/types/safety';
import type { DashboardNotificationType } from '@/types/analytics.types';
import type { UserRole } from '@/types/auth';

export interface DerivedAlert {
  id: string;
  type: DashboardNotificationType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  linkTo: string | null;
}

// Which roles should see each family of derived (state-based) alerts.
const AUDIENCE: Record<string, UserRole[]> = {
  certificates: ['hr_officer', 'plant_manager', 'admin', 'safety_officer'],
  permits: ['safety_officer', 'supervisor', 'plant_manager', 'admin'],
  pm: ['supervisor', 'plant_manager', 'admin', 'technician'],
  stock: ['store_keeper', 'supervisor', 'plant_manager', 'admin'],
  po: ['store_keeper', 'plant_manager', 'admin'],
};

const DAY = 86_400_000;

function toMs(v: unknown): number | null {
  const ts = v as { toDate?: () => Date; seconds?: number } | null | undefined;
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

function useCollectionWhenAllowed(
  name: string,
  companyId: string,
  allowed: boolean,
): Record<string, unknown>[] {
  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    if (!companyId || !allowed) {
      setDocs([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, name), where('companyId', '==', companyId)),
      (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setDocs([]),
    );
    return () => unsub();
  }, [name, companyId, allowed]);
  return docs;
}

/**
 * Live, state-derived alerts for things that are expiring or due, plus
 * low/out-of-stock and purchase-order alerts — each shown only to the roles
 * that own them. Unlike the event notifications in `notifications`, these are
 * computed from current data and clear automatically once the underlying
 * condition is resolved.
 */
export function useDerivedAlerts(): DerivedAlert[] {
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const role = (userProfile?.role ?? '') as UserRole;

  const sees = (key: keyof typeof AUDIENCE) => AUDIENCE[key].includes(role);

  const certificates = useCollectionWhenAllowed('trainingCertificates', companyId, sees('certificates'));
  const permits = useCollectionWhenAllowed('work_permits', companyId, sees('permits'));
  const pmSchedules = useCollectionWhenAllowed('pm_schedules', companyId, sees('pm'));
  const parts = useCollectionWhenAllowed('inventoryParts', companyId, sees('stock'));
  const purchaseOrders = useCollectionWhenAllowed('purchaseOrders', companyId, sees('po'));

  return useMemo(() => {
    const now = Date.now();
    const out: DerivedAlert[] = [];

    // Expiring / expired training certificates (within 30 days).
    for (const c of certificates) {
      if (c.isRevoked) continue;
      const exp = toMs(c.expiryDate);
      if (exp == null) continue;
      const days = Math.floor((exp - now) / DAY);
      if (days > 30) continue;
      const who = String(c.traineeName ?? 'A trainee');
      const what = String(c.moduleName ?? 'a module');
      out.push({
        id: `cert-${c.id}`,
        type: 'training',
        severity: days < 0 ? 'high' : 'medium',
        message:
          days < 0
            ? `Certificate expired: ${who} — ${what}`
            : `Certificate expiring in ${days}d: ${who} — ${what}`,
        linkTo: '/app/training/manage/certificates',
      });
    }

    // Work permits running past their validity.
    for (const p of permits) {
      if (!isWorkPermitOverdue({ status: p.status as never, validTo: String(p.validTo ?? '') })) continue;
      out.push({
        id: `permit-${p.id}`,
        type: 'alert',
        severity: 'high',
        message: `Work permit overdue: ${String(p.permitNumber ?? '')} ${String(p.title ?? '')}`.trim(),
        linkTo: '/app/safety/permits',
      });
    }

    // PMs due soon (7 days) or overdue.
    for (const pm of pmSchedules) {
      if (String(pm.status ?? 'active') !== 'active') continue;
      const due = toMs(pm.nextDueDate);
      if (due == null) continue;
      const days = Math.floor((due - now) / DAY);
      if (days > 7) continue;
      const machine = String(pm.machineName ?? 'a machine');
      out.push({
        id: `pm-${pm.id}`,
        type: 'pm',
        severity: days < 0 ? 'high' : 'medium',
        message: days < 0 ? `PM overdue: ${machine}` : `PM due in ${days}d: ${machine}`,
        linkTo: '/app/pm-schedules',
      });
    }

    // Low / out-of-stock parts.
    for (const part of parts) {
      const stock = Number(part.currentStock ?? 0);
      const min = Number(part.minStockLevel ?? 0);
      const name = String(part.name ?? part.partName ?? 'A part');
      if (stock <= 0) {
        out.push({ id: `stock-${part.id}`, type: 'parts', severity: 'critical', message: `Out of stock: ${name}`, linkTo: '/app/inventory' });
      } else if (min > 0 && stock <= min) {
        out.push({ id: `stock-${part.id}`, type: 'parts', severity: 'high', message: `Low stock: ${name} (${stock} left)`, linkTo: '/app/inventory' });
      }
    }

    // Purchase orders needing action: awaiting approval, or overdue delivery.
    for (const po of purchaseOrders) {
      const status = String(po.status ?? '');
      const num = String(po.poNumber ?? po.orderNumber ?? po.id);
      if (status === 'pending_approval') {
        out.push({ id: `po-appr-${po.id}`, type: 'parts', severity: 'high', message: `PO awaiting approval: ${num}`, linkTo: '/app/inventory' });
        continue;
      }
      const expected = toMs(po.expectedDelivery);
      const openStatuses = ['approved', 'sent', 'acknowledged', 'partially_received'];
      if (expected != null && expected < now && openStatuses.includes(status)) {
        out.push({ id: `po-late-${po.id}`, type: 'parts', severity: 'medium', message: `PO delivery overdue: ${num}`, linkTo: '/app/inventory' });
      }
    }

    // Most severe first.
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [certificates, permits, pmSchedules, parts, purchaseOrders]);
}
