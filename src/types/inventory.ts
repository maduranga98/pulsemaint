import type { Timestamp } from 'firebase/firestore';

// ─── Enums / Unions ────────────────────────────────────────────────────────

export type PartCategory =
  | 'bearings'
  | 'belts_chains'
  | 'bolts_fasteners'
  | 'electrical'
  | 'filters'
  | 'gaskets_seals'
  | 'gears_sprockets'
  | 'hydraulic'
  | 'lubricants_oils'
  | 'motors_drives'
  | 'pneumatic'
  | 'pumps_valves'
  | 'safety_equipment'
  | 'sensors_instrumentation'
  | 'welding_supplies'
  | 'other';

export type PartUnit =
  | 'pcs'
  | 'set'
  | 'kg'
  | 'g'
  | 'L'
  | 'mL'
  | 'm'
  | 'cm'
  | 'box'
  | 'roll'
  | 'pair'
  | 'bag'
  | 'drum';

export type PartStatus = 'active' | 'inactive' | 'discontinued';

export type PartCriticality = 'critical' | 'high' | 'medium' | 'low';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export type CadFileType = 'DWG' | 'DXF' | 'STEP' | 'STP' | 'IGES' | 'IGS' | 'STL';

export type MovementType =
  | 'issue'
  | 'return'
  | 'receive'
  | 'adjustment'
  | 'reserve'
  | 'unreserve'
  | 'import_create'
  | 'import_update'
  | 'transfer_out'
  | 'transfer_in';

export type ReferenceType =
  | 'parts_request'
  | 'work_order'
  | 'purchase_order'
  | 'manual_adjustment'
  | 'excel_import'
  | 'transfer';

export type RequestStatus =
  | 'pending_storekeeper'
  | 'pending_supervisor'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'parts_reserved'
  | 'issued'
  | 'completed'
  | 'cancelled';

export type ReviewDecision = 'approve' | 'escalate' | 'reject' | 'partial';

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'acknowledged'
  | 'received'
  | 'partially_received'
  | 'cancelled';

export type ImportSessionStatus =
  | 'validating'
  | 'preview'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'reversed';

export type InventoryCurrency = 'LKR' | 'USD' | 'SGD' | 'Other';

// ─── Sub-Interfaces ────────────────────────────────────────────────────────

export interface CadFile {
  name: string;
  url: string;
  type: CadFileType;
  uploadedAt: Timestamp;
  uploadedBy: string;
  fileSizeBytes: number;
}

export interface RequestItem {
  id: string;
  partId: string;
  partNumber: string;
  partName: string;
  unitCost: number;
  quantityRequested: number;
  quantityApproved: number;
  quantityIssued: number;
  quantityReturned: number;
  unit: PartUnit;
  notes: string;
  availableAtRequest: number;
  isAvailable: boolean;
  isCritical: boolean;
}

export interface StoreKeeperReview {
  reviewedBy: string;
  reviewedByName: string;
  reviewedAt: Timestamp;
  decision: ReviewDecision;
  notes: string;
  escalationReason: string;
}

export interface SupervisorReview {
  reviewedBy: string;
  reviewedByName: string;
  reviewedAt: Timestamp;
  decision: 'approve' | 'reject' | 'partial';
  notes: string;
  rejectionReason: string;
}

export interface PurchaseOrderItem {
  id: string;
  partId: string;
  partNumber: string;
  partName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
  leadTimeDays: number;
  expectedDelivery: Timestamp | null;
}

export interface ImportError {
  row: number;
  column: string;
  errorCode: ImportErrorCode;
  message: string;
}

export type ImportErrorCode =
  | 'REQUIRED_FIELD_EMPTY'
  | 'INVALID_UNIT'
  | 'INVALID_CATEGORY'
  | 'INVALID_STATUS'
  | 'INVALID_CRITICALITY'
  | 'NEGATIVE_QUANTITY'
  | 'INVALID_DATE_FORMAT'
  | 'DUPLICATE_PART_NUMBER'
  | 'INVALID_NUMBER'
  | 'PART_NUMBER_TOO_LONG'
  | 'NAME_TOO_LONG'
  | 'ROW_LIMIT_EXCEEDED';

// ─── Main Collection Interfaces ────────────────────────────────────────────

export interface InventoryPart {
  id: string;
  companyId: string;
  partNumber: string;
  name: string;
  description: string;
  brand: string;
  modelRef: string;
  category: PartCategory;
  unit: PartUnit;
  status: PartStatus;
  criticality: PartCriticality;

  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  reservedStock: number;
  availableStock: number;

  unitCost: number;
  lastPurchasePrice: number;
  lastPurchaseDate: Timestamp | null;

  storeLocation: string;
  supplierName: string;
  supplierContact: string;
  supplierPartCode: string;
  leadTimeDays: number;

  compatibleMachineIds: string[];
  warrantyMonths: number;

  cadFiles: CadFile[];
  images: string[];

  isCritical: boolean;
  isLowStock: boolean;

  totalUsedAllTime: number;
  totalCostAllTime: number;
  lastIssuedAt: Timestamp | null;
  lastReceivedAt: Timestamp | null;

  importedAt: Timestamp | null;
  importedFrom: string | null;

  notes: string;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface PartsRequest {
  id: string;
  companyId: string;
  requestNumber: string;

  workOrderId: string | null;
  workOrderNumber: string | null;
  workOrderType: string | null;
  machineId: string | null;
  machineName: string | null;

  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  requestedAt: Timestamp;

  isContractorJob: boolean;
  contractorCompany: string | null;

  items: RequestItem[];

  totalEstimatedCost: number;
  totalApprovedCost: number;

  status: RequestStatus;

  storeKeeperReview: StoreKeeperReview | null;
  supervisorReview: SupervisorReview | null;

  reservedAt: Timestamp | null;
  issuedAt: Timestamp | null;
  issuedBy: string | null;
  issuedByName: string | null;

  completedAt: Timestamp | null;
  returnedAt: Timestamp | null;

  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  isUrgent: boolean;
}

export interface StockMovement {
  id: string;
  companyId: string;
  partId: string;
  partNumber: string;
  partName: string;

  movementType: MovementType;

  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;

  referenceType: ReferenceType;
  referenceId: string;

  workOrderId: string | null;
  workOrderNumber: string | null;
  partsRequestId: string | null;

  performedBy: string;
  performedByName: string;
  performedByRole: string;
  performedAt: Timestamp;

  notes: string;
  unitCostAtTime: number;
  totalCostImpact: number;
}

export interface PurchaseOrder {
  id: string;
  companyId: string;
  poNumber: string;

  status: PurchaseOrderStatus;

  supplierName: string;
  supplierContact: string;
  supplierContactPerson?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  currency: InventoryCurrency;

  items: PurchaseOrderItem[];

  totalOrderValue: number;
  totalReceivedValue: number;

  raisedBy: string;
  raisedByName: string;
  raisedByRole?: string;
  raisedAt: Timestamp;

  approvedBy?: string | null;
  approvedByName?: string | null;
  approvedAt?: Timestamp | null;
  rejectedReason?: string | null;

  sentAt: Timestamp | null;
  acknowledgedAt: Timestamp | null;
  receivedAt: Timestamp | null;

  notes: string;
  attachments: { name: string; url: string }[];
}

export interface InventoryImportSession {
  id: string;
  companyId: string;
  status: ImportSessionStatus;
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  newPartsCount: number;
  updatedPartsCount: number;
  skippedCount: number;
  importedBy: string;
  importedByName: string;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  reversedAt: Timestamp | null;
  reversedBy: string | null;
  errors: ImportError[];
  affectedPartIds: string[];
}

export interface InventorySettings {
  companyId: string;
  approvalThresholdLKR: number;
  defaultCurrency: InventoryCurrency;
  lowStockAlertEnabled: boolean;
  lowStockNotifyRoles: string[];
  autoReserveOnApproval: boolean;
  requireReturnLog: boolean;
  partNumberPrefix: string;
  poNumberPrefix: string;
  requestNumberPrefix: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ─── Form Payloads ─────────────────────────────────────────────────────────

export interface CreatePartPayload {
  partNumber: string;
  name: string;
  description: string;
  brand: string;
  modelRef: string;
  category: PartCategory;
  unit: PartUnit;
  status: PartStatus;
  criticality: PartCriticality;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number;
  unitCost: number;
  storeLocation: string;
  supplierName: string;
  supplierContact: string;
  supplierPartCode: string;
  leadTimeDays: number;
  lastPurchaseDate: string | null;
  lastPurchasePrice: number;
  warrantyMonths: number;
  compatibleMachineIds: string[];
  notes: string;
}

export type UpdatePartPayload = Partial<CreatePartPayload>;

// ─── Excel Import Types ───────────────────────────────────────────────────

export interface ParsedPartRow {
  rowIndex: number;
  partNumber: string;
  name: string;
  unit: string;
  category: string;
  currentStock: string;
  minStockLevel: string;
  maxStockLevel: string;
  unitCost: string;
  supplierName: string;
  compatibleMachineIds: string;
  status: string;
  description: string;
  brand: string;
  modelRef: string;
  storeLocation: string;
  supplierPartCode: string;
  supplierContact: string;
  leadTimeDays: string;
  lastPurchaseDate: string;
  lastPurchasePrice: string;
  warrantyMonths: string;
  criticality: string;
  notes: string;
}

export interface ValidationError {
  row: number;
  column: string;
  errorCode: ImportErrorCode;
  message: string;
  fixHint: string;
}

export interface ParsedImportResult {
  rows: ParsedPartRow[];
  totalRows: number;
}

export interface ValidationResult {
  validRows: ParsedPartRow[];
  errors: ValidationError[];
  createCount: number;
  updateCount: number;
  isValid: boolean;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────

export interface InventoryStats {
  totalParts: number;
  totalStockValue: number;
  activeRequests: number;
  pendingPOs: number;
  outOfStockCount: number;
  lowStockCount: number;
  pendingRequestsCount: number;
  pendingSupervisorCount: number;
  partsToIssueCount: number;
}

// ─── Receive Stock ────────────────────────────────────────────────────────

export interface ReceiveItem {
  partId: string;
  partNumber: string;
  partName: string;
  unit: PartUnit;
  quantityReceived: number;
  unitCost: number;
  condition: 'good' | 'damaged' | 'wrong_item';
  notes: string;
  poItemId?: string;
}

export interface ReceiveStockPayload {
  poId?: string;
  items: ReceiveItem[];
  receiveDate: string;
  deliveryReference: string;
  supplierName: string;
  notes: string;
}
