import { useEffect, useMemo, useState } from 'react';
import { collectionGroup, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useContractors } from './useContractors';
import type { ContractorDocument } from '@/lib/contractors/contractorTypes';

export function useDocumentCompliance() {
  const companyId = useAuthStore((state) => state.userProfile?.companyId);
  const { contractors, loading: contractorsLoading } = useContractors();
  const [documents, setDocuments] = useState<ContractorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    return onSnapshot(
      query(collectionGroup(db, 'documents'), where('companyId', '==', companyId)),
      (snapshot) => {
        setDocuments(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ContractorDocument));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [companyId]);

  const summary = useMemo(() => {
    const activeDocs = documents.filter((doc) => !doc.supersededBy);
    const contractorsWithExpired = new Set(activeDocs.filter((doc) => doc.validityStatus === 'expired').map((doc) => doc.contractorId));
    const contractorsWithExpiring = new Set(activeDocs.filter((doc) => doc.validityStatus === 'expiring_soon').map((doc) => doc.contractorId));
    const blockedContractors = new Set(activeDocs.filter((doc) => doc.blocksAssignment).map((doc) => doc.contractorId));

    return {
      totalContractors: contractors.length,
      fullyValid: Math.max(0, contractors.length - contractorsWithExpired.size - contractorsWithExpiring.size),
      expiringCount: contractorsWithExpiring.size,
      blockedCount: blockedContractors.size,
      expiringDocuments: activeDocs.filter((doc) => doc.validityStatus === 'expiring_soon'),
      blockingDocuments: activeDocs.filter((doc) => doc.blocksAssignment),
    };
  }, [contractors.length, documents]);

  return {
    contractors,
    documents,
    summary,
    loading: loading || contractorsLoading,
    error,
  };
}
