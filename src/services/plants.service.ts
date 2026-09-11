import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
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
  return onSnapshot(
    query(collection(db, PLANTS), where('companyId', '==', companyId), orderBy('name', 'asc')),
    (snap) => cb(snap.docs.map((d) => mapPlant(d.id, d.data()))),
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
