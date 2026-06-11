import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './breakdown';

// ---------------------------------------------------------------------------
// Machine Status & Criticality
// ---------------------------------------------------------------------------

export type MachineStatus = 'active' | 'under_maintenance' | 'decommissioned';

export type MachineCriticality = 1 | 2 | 3 | 4 | 5;

export type MachineType =
  | 'cnc_machine'
  | 'conveyor'
  | 'compressor'
  | 'boiler'
  | 'generator'
  | 'hydraulic_press'
  | 'pump'
  | 'motor'
  | 'crane'
  | 'lathe'
  | 'milling_machine'
  | 'welding_machine'
  | 'hvac'
  | 'other';

export type DocumentType = 'manual' | 'schematic' | 'warranty' | 'certificate' | 'sop' | 'photo' | 'other';

// ---------------------------------------------------------------------------
// Warranty & Spare Parts
// ---------------------------------------------------------------------------

export interface WarrantyItem {
  partName: string;
  expiryDate: Timestamp;
  supplierWarrantyRef: string;
}

export interface MachineDocument {
  name: string;
  type: DocumentType;
  url: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
  size?: number;
}

// ---------------------------------------------------------------------------
// Isolation Points (LOTO/PTW)
// ---------------------------------------------------------------------------

export type IsolationPointType = 'electrical' | 'hydraulic' | 'pneumatic' | 'mechanical' | 'thermal';

export interface IsolationPoint {
  id: string;
  type: IsolationPointType;
  label: string;
  location: string;
}

// ---------------------------------------------------------------------------
// Core Machine Interface
// ---------------------------------------------------------------------------

export interface Machine {
  // Identity
  id: string;
  siteId: string;
  name: string;
  model: string;
  serialNumber: string;
  manufacturer: string;

  // Dates
  purchaseDate: Timestamp | null;
  installationDate: Timestamp | null;
  expectedLifespanYears: number | null;

  // Lifecycle / TCO
  purchasePrice: number | null;
  replacementValue: number | null;

  // Location
  department: string;
  floor: string | null;
  bay: string | null;
  station: string | null;

  // Status & Health
  status: MachineStatus;
  criticality: MachineCriticality;
  healthScore: number; // 0-100
  type: MachineType;

  // Service History
  lastServiceDate: Timestamp | null;
  lastServiceType: string | null;
  lastTechnicians: string[];
  nextPmDue: Timestamp | null;
  partsReplaced: string[];

  // Parts & Documents
  compatiblePartIds: string[];
  documents: MachineDocument[];
  photos: string[]; // Firebase Storage URLs
  warrantyItems: WarrantyItem[];
  isolationPoints: IsolationPoint[];

  // Additional Info
  modificationNotes: string | null;
  sopLibraryRefs: string[];
  qrCode: string | null; // Firebase Storage URL

  // Phase 3 Placeholders
  oeeData: Record<string, unknown> | null;
  iotSensorId: string | null;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Form Payload (user input, pre-Firestore)
// ---------------------------------------------------------------------------

export interface CreateMachinePayload {
  siteId: string;
  name: string;
  type: MachineType;
  manufacturer: string;
  model: string;
  serialNumber: string;
  purchaseDate: Date | null;
  installationDate: Date | null;
  nextPmDue: Date | null;
  expectedLifespanYears: number | null;
  purchasePrice?: number | null;
  replacementValue?: number | null;
  department: string;
  floor: string | null;
  bay: string | null;
  station: string | null;
  status: MachineStatus;
  criticality: MachineCriticality;
  healthScore: number;
  warrantyItems?: Array<{ partName: string; expiryDate: Date | null; supplierWarrantyRef: string }>;
  photoFiles: File[];
  documentFiles: Array<{ file: File; type: DocumentType; name: string }>;
  compatiblePartIds: string[];
  modificationNotes: string | null;
  additionalNotes: string | null;
}

export interface UpdateMachinePayload {
  siteId: string;
  machineId: string;
  name?: string;
  type?: MachineType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date | null;
  installationDate?: Date | null;
  nextPmDue?: Date | null;
  expectedLifespanYears?: number | null;
  purchasePrice?: number | null;
  replacementValue?: number | null;
  department?: string;
  floor?: string | null;
  bay?: string | null;
  station?: string | null;
  status?: MachineStatus;
  criticality?: MachineCriticality;
  healthScore?: number;
  warrantyItems?: Array<{ partName: string; expiryDate: Date | null; supplierWarrantyRef: string }>;
  photoFiles?: File[];
  documentFiles?: Array<{ file: File; type: DocumentType; name: string }>;
  compatiblePartIds?: string[];
  modificationNotes?: string | null;
  additionalNotes?: string | null;
}

// ---------------------------------------------------------------------------
// Machine History
// ---------------------------------------------------------------------------

export interface MachineBreakdownEntry {
  breakdownId: string;
  date: Timestamp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  status: string;
  rootCause: string | null;
  duration: number | null; // minutes
  linkedWOId: string | null;
}

export interface MachineMaintenanceEntry {
  woId: string;
  woNumber: string;
  type: string;
  dateCompleted: Timestamp;
  technicians: string[];
  description: string;
  partsReplaced: string[];
  duration: number | null; // minutes
  testResult: 'pass' | 'fail' | 'partial';
}

// ---------------------------------------------------------------------------
// Machine Analytics
// ---------------------------------------------------------------------------

export interface MachineAnalytics {
  totalBreakdowns: number;
  criticalBreakdowns: number;
  averageMttr: number; // minutes
  averageMtbf: number; // hours
  downtimePercentage: number;
  pmCompliancePercentage: number;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface MachineFilters {
  search: string;
  departments: string[];
  statuses: MachineStatus[];
  criticalities: MachineCriticality[];
  healthScoreRange: [number, number]; // [min, max] 0-100
  dateFrom: Date | null;
  dateTo: Date | null;
}

// ---------------------------------------------------------------------------
// Permissions Helper
// ---------------------------------------------------------------------------

export type MachinePermission =
  | 'view'
  | 'edit'
  | 'delete'
  | 'upload_documents'
  | 'generate_qr'
  | 'decommission';

export interface MachineRolePermissions {
  role: UserRole;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canUploadDocuments: boolean;
  canGenerateQr: boolean;
  canDecommission: boolean;
  canViewAnalytics: boolean;
}
