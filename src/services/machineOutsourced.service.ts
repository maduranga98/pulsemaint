import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { outsourcedJobTotals } from '../lib/machineAsset';
import type { InvoiceFile, OutsourcedMaintenance } from '../types/outsourcedMaintenance';

const COL = 'machineOutsourcedMaintenance';
export const MAX_INVOICE_BYTES = 15 * 1024 * 1024;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function fromDoc(id: string, d: Record<string, any>): OutsourcedMaintenance {
  return {
    id,
    siteId: str(d.siteId),
    machineId: str(d.machineId),
    contractorId: typeof d.contractorId === 'string' ? d.contractorId : null,
    contractorName: str(d.contractorName),
    workOrderId: typeof d.workOrderId === 'string' ? d.workOrderId : null,
    jobType: d.jobType ?? 'repair',
    description: str(d.description),
    startedAt: n(d.startedAt),
    completedAt: typeof d.completedAt === 'number' ? d.completedAt : null,
    parts: Array.isArray(d.parts) ? d.parts : [],
    partsTotal: n(d.partsTotal),
    labourCost: n(d.labourCost),
    totalCost: n(d.totalCost),
    currency: str(d.currency),
    invoiceNumber: str(d.invoiceNumber),
    invoiceFiles: Array.isArray(d.invoiceFiles) ? d.invoiceFiles : [],
    notes: str(d.notes),
    createdBy: str(d.createdBy),
    createdByName: str(d.createdByName),
    createdAt: n(d.createdAt),
  };
}

/** Live list of a machine's outsourced jobs, newest first. */
export function subscribeOutsourcedMaintenance(
  siteId: string, machineId: string, cb: (rows: OutsourcedMaintenance[]) => void, onError: (e: Error) => void,
) {
  const q = query(collection(db, COL), where('siteId', '==', siteId), where('machineId', '==', machineId));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => fromDoc(d.id, d.data())).sort((a, b) => b.startedAt - a.startedAt || b.createdAt - a.createdAt));
  }, onError);
}

export type NewOutsourcedMaintenance = Omit<OutsourcedMaintenance,
  'id' | 'partsTotal' | 'totalCost' | 'invoiceFiles' | 'createdAt'>;

/** Saves the job (totals are recomputed from the parts here, never trusted from the form) and uploads its invoices. */
export async function createOutsourcedMaintenance(
  companyId: string, input: NewOutsourcedMaintenance, files: File[],
): Promise<string> {
  const { partsTotal, total } = outsourcedJobTotals(input.parts, input.labourCost);
  const invoiceFiles: InvoiceFile[] = [];
  const stamp = Date.now();
  for (const [i, file] of files.entries()) {
    if (file.size > MAX_INVOICE_BYTES) throw new Error(`"${file.name}" is larger than 15 MB.`);
    const safe = file.name.replace(/[^\w.-]+/g, '_');
    const path = `companies/${companyId}/machineOutsourced/${input.machineId}/${stamp}_${i}_${safe}`;
    await uploadBytes(ref(storage, path), file, { contentType: file.type || undefined });
    invoiceFiles.push({ name: file.name, url: await getDownloadURL(ref(storage, path)), path });
  }
  const docRef = await addDoc(collection(db, COL), {
    ...input, partsTotal, totalCost: total, invoiceFiles, createdAt: stamp,
  });
  return docRef.id;
}

export async function deleteOutsourcedMaintenance(row: OutsourcedMaintenance): Promise<void> {
  await deleteDoc(doc(db, COL, row.id));
  await Promise.all(row.invoiceFiles.map((f) => deleteObject(ref(storage, f.path)).catch(() => undefined)));
}
