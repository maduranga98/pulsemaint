import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TraineeProgrammeCertificate } from '../../types/traineeProgram';

interface UseProgrammeCertificateResult {
  certificate: TraineeProgrammeCertificate | null;
  loading: boolean;
}

export function useProgrammeCertificate(certificateId: string | null): UseProgrammeCertificateResult {
  const [certificate, setCertificate] = useState<TraineeProgrammeCertificate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certificateId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'traineeProgrammeCertificates', certificateId), (snap) => {
      setCertificate(snap.exists() ? ({ id: snap.id, ...snap.data() } as TraineeProgrammeCertificate) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [certificateId]);

  return { certificate, loading };
}
