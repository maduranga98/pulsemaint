import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { TriageFlow } from '../../types/triage';

async function queryFirstFlow(
  companyId: string,
  constraints: Parameters<typeof query>[1][]
): Promise<TriageFlow | null> {
  try {
    const q = query(
      collection(db, 'triageFlows'),
      where('companyId', '==', companyId),
      where('isActive', '==', true),
      ...constraints,
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() } as TriageFlow;
    }
  } catch (err) {
    console.error('triageFlowResolver query error:', err);
  }
  return null;
}

/**
 * Priority: specificMachineId match → machineTypeId match → isTemplate fallback
 */
export async function resolveTriageFlow(
  companyId: string,
  machineId: string,
  machineTypeId: string | null
): Promise<TriageFlow | null> {
  // 1. Try specific machine flow
  const specificFlow = await queryFirstFlow(companyId, [
    where('specificMachineId', '==', machineId),
  ]);
  if (specificFlow) return specificFlow;

  // 2. Try machine type flow
  if (machineTypeId) {
    const typeFlow = await queryFirstFlow(companyId, [
      where('machineTypeId', '==', machineTypeId),
      where('specificMachineId', '==', null),
    ]);
    if (typeFlow) return typeFlow;
  }

  // 3. Try template fallback (isTemplate=true, machineTypeId=null = generic)
  const templateFlow = await queryFirstFlow(companyId, [
    where('isTemplate', '==', true),
    where('machineTypeId', '==', null),
  ]);
  return templateFlow;
}
