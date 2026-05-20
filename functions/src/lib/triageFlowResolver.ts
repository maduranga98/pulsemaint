import * as admin from 'firebase-admin';

export interface TriageFlowData {
  id: string;
  steps: Array<{ id: string; stepNumber: number }>;
  name: string;
  language: string;
  emergencyContacts: Array<{ name: string; phone: string; role: string }>;
  machineShutdownProcedure: string;
}

async function queryFirstFlow(
  db: admin.firestore.Firestore,
  companyId: string,
  extraConstraints: Array<[string, FirebaseFirestore.WhereFilterOp, unknown]>
): Promise<TriageFlowData | null> {
  try {
    let ref: admin.firestore.Query = db
      .collection('triageFlows')
      .where('companyId', '==', companyId)
      .where('isActive', '==', true);

    for (const [field, op, val] of extraConstraints) {
      ref = ref.where(field, op, val);
    }

    const snap = await ref.limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<TriageFlowData, 'id'>) };
    }
  } catch (err) {
    console.error('triageFlowResolver error:', err);
  }
  return null;
}

export async function resolveTriageFlow(
  companyId: string,
  machineId: string,
  machineTypeId: string | null
): Promise<TriageFlowData | null> {
  const db = admin.firestore();

  const specific = await queryFirstFlow(db, companyId, [['specificMachineId', '==', machineId]]);
  if (specific) return specific;

  if (machineTypeId) {
    const byType = await queryFirstFlow(db, companyId, [
      ['machineTypeId', '==', machineTypeId],
      ['specificMachineId', '==', null],
    ]);
    if (byType) return byType;
  }

  return queryFirstFlow(db, companyId, [
    ['isTemplate', '==', true],
    ['machineTypeId', '==', null],
  ]);
}
