import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CreatePlantPayload, Plant, UpdatePlantPayload } from '../types/plant';

const PLANTS = 'plants';

function mapPlant(id: string, d: Record<string, unknown>): Plant {
  return { id, ...(d as Omit<Plant, 'id'>) };
}

export function subscribePlants(
  companyId: string,
  cb: (plants: Plant[]) => void,
  onError?: (msg: string) => void,
): () => void {
  // Sorted client-side (rather than an orderBy('name') server-side) so this
  // never needs a composite index alongside the companyId filter.
  return onSnapshot(
    query(collection(db, PLANTS), where('companyId', '==', companyId)),
    (snap) => {
      const plants = snap.docs.map((d) => mapPlant(d.id, d.data()));
      plants.sort((a, b) => a.name.localeCompare(b.name));
      cb(plants);
    },
    (err) => onError?.(err.message),
  );
}

export async function createPlant(
  companyId: string,
  userId: string,
  payload: CreatePlantPayload,
): Promise<string> {
  const ref = await addDoc(collection(db, PLANTS), {
    companyId,
    name: payload.name,
    code: payload.code ?? null,
    address: payload.address ?? null,
    contactPerson: payload.contactPerson ?? null,
    status: 'active',
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  return ref.id;
}

export async function updatePlant(
  plantId: string,
  userId: string,
  payload: UpdatePlantPayload,
): Promise<void> {
  await updateDoc(doc(db, PLANTS, plantId), {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
