import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ContractorJob } from './contractorTypes';
import { calculateContractorMetrics } from './performanceCalculator';

/**
 * Recomputes a contractor's job stats (completed job count, last job date, ratings,
 * SLA compliance, etc.) from their live contractorJobs and persists them onto the
 * contractor record. Call this whenever a contractor job transitions to a completed
 * state (e.g. sign-off) so the contractor list/profile stay in sync.
 */
export async function syncContractorMetrics(contractorId: string, companyId: string): Promise<void> {
  if (!contractorId || !companyId) return;

  const jobsQuery = query(
    collection(db, 'contractorJobs'),
    where('companyId', '==', companyId),
    where('contractorId', '==', contractorId),
  );
  const snapshot = await getDocs(jobsQuery);
  const jobs = snapshot.docs.map((jobDoc) => ({ id: jobDoc.id, ...jobDoc.data() }) as ContractorJob);
  const metrics = calculateContractorMetrics(jobs);

  await updateDoc(doc(db, 'contractors', contractorId), {
    ...metrics,
    updatedAt: serverTimestamp(),
  });
}
