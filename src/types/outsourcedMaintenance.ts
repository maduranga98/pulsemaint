import type { OutsourcedPart } from '../lib/machineAsset';

export type OutsourcedJobType = 'repair' | 'service' | 'overhaul' | 'installation' | 'other';

export const OUTSOURCED_JOB_TYPES: { value: OutsourcedJobType; label: string }[] = [
  { value: 'repair', label: 'Repair' },
  { value: 'service', label: 'Service' },
  { value: 'overhaul', label: 'Overhaul' },
  { value: 'installation', label: 'Installation / upgrade' },
  { value: 'other', label: 'Other' },
];

export interface InvoiceFile {
  name: string;
  url: string;
  /** Storage path, kept so the file can be removed with the record. */
  path: string;
}

/** Maintenance on a machine done by an outside company, with the parts fitted and what it cost. */
export interface OutsourcedMaintenance {
  id: string;
  siteId: string;
  machineId: string;
  /** Contractors-registry id when picked from the registry. */
  contractorId: string | null;
  contractorName: string;
  jobType: OutsourcedJobType;
  description: string;
  /** Job start / finish, ms. */
  startedAt: number;
  completedAt: number | null;
  parts: OutsourcedPart[];
  partsTotal: number;
  /** Contractor's labour / service charge, excluding parts. */
  labourCost: number;
  totalCost: number;
  currency: string;
  invoiceNumber: string;
  invoiceFiles: InvoiceFile[];
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
}
