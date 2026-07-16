import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';
import { deriveDocumentExpiry, getContractorDocumentStatus, timestampToDate } from '@/lib/contractors/documentExpiryHelper';

// Stored validity fields go stale (and older writes hardcoded validityStatus:
// 'valid' with no daysUntilExpiry), so recompute them from expiryDate on read.
function withDerivedExpiry(document: ContractorDocument): ContractorDocument {
  const expiry = timestampToDate(document.expiryDate);
  const derived = deriveDocumentExpiry(expiry, document.isPermanent ?? !expiry, document.documentType);
  return {
    ...document,
    ...derived,
    isCriticalDocument: document.isCriticalDocument || derived.isCriticalDocument,
    blocksAssignment: derived.blocksAssignment || ((document.isCriticalDocument ?? false) && derived.validityStatus === 'expired'),
  };
}

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
        setDocuments(snapshot.docs.map((doc) => withDerivedExpiry({ id: doc.id, ...doc.data() } as ContractorDocument)));
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
