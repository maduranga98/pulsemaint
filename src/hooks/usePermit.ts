import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Permit, IsolationChecklistEntry } from '../types/permit';
import type { IsolationPoint } from '../types/machine';

interface UsePermitParams {
  workOrderId: string;
  machineId: string;
  siteId: string;
}

interface UsePermitResult {
  permit: Permit | null;
  loading: boolean;
  error: string | null;
  allPointsLocked: boolean;
  lotoGatePassed: boolean;
  createPermit: (isolationPoints: IsolationPoint[]) => Promise<void>;
  lockPoint: (pointId: string, uid: string, userName: string) => Promise<void>;
  unlockPoint: (pointId: string) => Promise<void>;
  verifyZeroEnergy: (uid: string, userName: string) => Promise<void>;
  issuePermit: (uid: string, userName: string) => Promise<void>;
  closePermit: (uid: string, userName: string) => Promise<void>;
}

export function usePermit({ workOrderId, machineId, siteId }: UsePermitParams): UsePermitResult {
  const [permit, setPermit] = useState<Permit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workOrderId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'permits'),
      where('workOrderId', '==', workOrderId),
      limit(1),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setPermit(null);
        } else {
          const docSnap = snap.docs[0];
          setPermit({ id: docSnap.id, ...docSnap.data() } as Permit);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [workOrderId]);

  const allPointsLocked =
    permit !== null &&
    permit.isolationChecklist.length > 0 &&
    permit.isolationChecklist.every((e) => e.locked);

  const lotoGatePassed =
    allPointsLocked &&
    (permit?.zeroEnergyVerified ?? false) &&
    (!permit?.category || permit?.status === 'active');

  const createPermit = useCallback(
    async (isolationPoints: IsolationPoint[]) => {
      const isolationChecklist: IsolationChecklistEntry[] = isolationPoints.map((ip) => ({
        pointId: ip.id,
        locked: false,
        lockedBy: null,
        lockedByName: null,
        lockedAt: null,
      }));

      await addDoc(collection(db, 'permits'), {
        workOrderId,
        machineId,
        siteId,
        type: 'LOTO' as const,
        category: null,
        isolationChecklist,
        zeroEnergyVerified: false,
        zeroEnergyVerifiedBy: null,
        zeroEnergyVerifiedByName: null,
        zeroEnergyVerifiedAt: null,
        status: 'draft' as const,
        issuedBy: null,
        issuedByName: null,
        issuedAt: null,
        closedBy: null,
        closedByName: null,
        closedAt: null,
        cancelledBy: null,
        cancelledAt: null,
        createdBy: '',
        createdByName: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [workOrderId, machineId, siteId],
  );

  const lockPoint = useCallback(
    async (pointId: string, uid: string, userName: string) => {
      if (!permit) return;
      const updated = permit.isolationChecklist.map((entry) =>
        entry.pointId === pointId
          ? { ...entry, locked: true, lockedBy: uid, lockedByName: userName, lockedAt: serverTimestamp() as any }
          : entry,
      );
      await updateDoc(doc(db, 'permits', permit.id), {
        isolationChecklist: updated,
        updatedAt: serverTimestamp(),
      });
    },
    [permit],
  );

  const unlockPoint = useCallback(
    async (pointId: string) => {
      if (!permit) return;
      const updated = permit.isolationChecklist.map((entry) =>
        entry.pointId === pointId
          ? { ...entry, locked: false, lockedBy: null, lockedByName: null, lockedAt: null }
          : entry,
      );
      await updateDoc(doc(db, 'permits', permit.id), {
        isolationChecklist: updated,
        updatedAt: serverTimestamp(),
      });
    },
    [permit],
  );

  const verifyZeroEnergy = useCallback(
    async (uid: string, userName: string) => {
      if (!permit) return;
      await updateDoc(doc(db, 'permits', permit.id), {
        zeroEnergyVerified: true,
        zeroEnergyVerifiedBy: uid,
        zeroEnergyVerifiedByName: userName,
        zeroEnergyVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [permit],
  );

  const issuePermit = useCallback(
    async (uid: string, userName: string) => {
      if (!permit) return;
      await updateDoc(doc(db, 'permits', permit.id), {
        status: 'active' as const,
        issuedBy: uid,
        issuedByName: userName,
        issuedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [permit],
  );

  const closePermit = useCallback(
    async (uid: string, userName: string) => {
      if (!permit) return;
      await updateDoc(doc(db, 'permits', permit.id), {
        status: 'closed' as const,
        closedBy: uid,
        closedByName: userName,
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [permit],
  );

  return {
    permit,
    loading,
    error,
    allPointsLocked,
    lotoGatePassed,
    createPermit,
    lockPoint,
    unlockPoint,
    verifyZeroEnergy,
    issuePermit,
    closePermit,
  };
}
