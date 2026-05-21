import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { TrainingCertificate } from '@/lib/training/trainingTypes';

export interface UseTrainingCertificatesOptions {
  traineeId?: string;
  includeRevoked?: boolean;
}

interface UseTrainingCertificatesResult {
  certificates: TrainingCertificate[];
  loading: boolean;
  error: string | null;
}

export function useTrainingCertificates(
  options: UseTrainingCertificatesOptions = {}
): UseTrainingCertificatesResult {
  const { traineeId, includeRevoked = false } = options;
  const companyId = useAuthStore((s) => s.userProfile?.companyId);

  const [certificates, setCertificates] = useState<TrainingCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [
      where('companyId', '==', companyId),
    ];

    if (traineeId) {
      constraints.push(where('traineeId', '==', traineeId));
    }

    if (!includeRevoked) {
      constraints.push(where('isRevoked', '==', false));
    }

    constraints.push(orderBy('issuedAt', 'desc'));

    const q = query(collection(db, 'trainingCertificates'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setCertificates(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingCertificate)
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, traineeId, includeRevoked]);

  return { certificates, loading, error };
}

// ---------------------------------------------------------------------------
// Standalone mutation
// ---------------------------------------------------------------------------

export async function revokeCertificate(
  certificateId: string,
  reason: string,
  revokedBy: string
): Promise<void> {
  const certRef = doc(db, 'trainingCertificates', certificateId);

  await updateDoc(certRef, {
    isRevoked: true,
    revokedAt: serverTimestamp(),
    revokedReason: reason,
    revokedBy,
  });
}
