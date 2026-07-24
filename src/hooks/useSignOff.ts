import { useState, useCallback } from 'react';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { WOSignOffPayload } from '../types/workOrder';
import type { BreakdownStatus } from '../types/breakdown';
import { useAuthStore } from '../store/authStore';
import { logAuditEvent } from '../utils/reports/auditLogger';
import { syncPmScheduleWoStatus } from '../utils/pmScheduleSync';
import { toast } from 'sonner';

interface UseSignOffResult {
  signOff: (woId: string, siteId: string, payload: WOSignOffPayload) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

// Signing off a work order is a single, terminal action: it records the
// closing disposition (outcome + optional reason/note), stamps who signed off
// and closed it automatically (no manual signature), and moves the WO straight
// to CLOSED. It cannot be reversed or restarted.
export function useSignOff(): UseSignOffResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);

  const signOff = useCallback(
    async (woId: string, _siteId: string, payload: WOSignOffPayload): Promise<boolean> => {
      if (!user) return false;

      const needsReason = payload.outcome === 'not_complete' || payload.outcome === 'failed';
      if (needsReason && !payload.outcomeReason?.trim()) {
        const msg =
          payload.outcome === 'failed'
            ? 'A reason is required when the work order is marked as failed.'
            : 'A reason is required when the work order is not complete.';
        setError(msg);
        toast.error(msg);
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const profile = useAuthStore.getState().userProfile;
        const actorName = user.displayName || profile?.fullName || '';
        const now = Timestamp.now();
        const notes = payload.notes.trim() || null;
        const reason = needsReason ? payload.outcomeReason!.trim() : null;

        // A single note describing the disposition, reused for both the
        // sign-off and close history entries so the timeline reads clearly.
        const outcomeLabel =
          payload.outcome === 'complete'
            ? 'Complete'
            : payload.outcome === 'failed'
            ? 'Failed'
            : 'Not complete';
        const historyNote = [
          `Outcome: ${outcomeLabel}`,
          reason ? `Reason: ${reason}` : null,
          notes ? `Note: ${notes}` : null,
        ]
          .filter(Boolean)
          .join(' — ');

        const signOffEntry = {
          status: 'SIGNED_OFF' as const,
          changedBy: user.uid,
          changedByName: actorName,
          changedAt: now,
          note: historyNote || null,
        };
        const closedEntry = {
          status: 'CLOSED' as const,
          changedBy: user.uid,
          changedByName: actorName,
          changedAt: now,
          note: null,
        };

        await updateDoc(doc(db, 'workOrders', woId), {
          status: 'CLOSED',
          // Sign-off and close happen together — record both transitions.
          statusHistory: arrayUnion(signOffEntry, closedEntry),
          // Automatically captured — no manual signature is collected.
          supervisorSignOffSignature: null,
          supervisorSignOffBy: user.uid,
          supervisorSignOffByName: actorName,
          supervisorSignOffAt: serverTimestamp(),
          supervisorSignOffNotes: notes,
          signOffOutcome: payload.outcome,
          signOffOutcomeReason: reason,
          closedBy: user.uid,
          closedByName: actorName,
          closedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Keep the linked PM schedule in sync with the signed-off/closed WO.
        await syncPmScheduleWoStatus(woId, 'CLOSED');

        // Keep a linked breakdown ticket in sync — closing the WO closes it.
        try {
          const snap = await getDoc(doc(db, 'workOrders', woId));
          const data = snap.data() as { linkedBreakdownId?: string | null; woNumber?: string } | undefined;
          if (data?.linkedBreakdownId) {
            const bdStatus: BreakdownStatus = 'closed';
            await updateDoc(doc(db, 'breakdown_tickets', data.linkedBreakdownId), {
              status: bdStatus,
              closedAt: serverTimestamp(),
              statusHistory: arrayUnion({
                status: bdStatus,
                changedBy: user.uid,
                changedByName: actorName,
                changedAt: now,
                note: `WO ${data.woNumber ?? woId} signed off and closed`,
              }),
            });
          }
        } catch (bdErr) {
          console.error('Failed to sync breakdown on sign-off', bdErr);
        }

        if (profile) {
          logAuditEvent({
            companyId: profile.companyId,
            userId: user.uid,
            userName: actorName,
            userRole: profile.role,
            action: 'SIGN_OFF',
            entityType: 'work_order',
            entityId: woId,
            entityName: woId,
          }).catch(() => {});
        }

        toast.success('Work order signed off and closed.');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sign-off failed';
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  return { signOff, loading, error };
}
