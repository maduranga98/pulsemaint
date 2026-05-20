import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { getContractorDocumentStatus } from '@/lib/contractors/documentExpiryHelper';

export function useContractorDocuments(contractorId: string | undefined) {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractorId || !companyId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const documentsRef = collection(db, 'contractors', contractorId, 'documents');
    const documentsQuery = query(documentsRef, where('companyId', '==', companyId), orderBy('uploadedAt', 'desc'));

    return onSnapshot(
      documentsQuery,
      (snapshot) => {
        setDocuments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ContractorDocument));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [companyId, contractorId]);

  const documentStatus = useMemo(() => getContractorDocumentStatus(documents), [documents]);

  return { documents, documentStatus, loading, error };
}
