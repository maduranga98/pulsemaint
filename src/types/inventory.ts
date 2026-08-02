import type { Timestamp } from 'firebase/firestore';

// ─── Enums / Unions ────────────────────────────────────────────────────────

// The six standard categories, or a freeform, manually-created category name.
export type PartCategory =
  | 'electrical'
  | 'mechanical'
  | 'hydraulic'
  | 'pneumatic'
  | 'automation'
  | 'civil'
  | (string & {});

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
  | 'invoice_received'
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

// Warranty document/image (receipt, certificate, warranty card photo, etc.)
// attached to a part. Optional — a part may have none.
export interface WarrantyDocument {
  name: string;
  url: string;
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
  // Set by the store keeper at issue/collection time — marks this item as
  // eligible for the requester to later hand it back via the return workflow.
  isReturnable?: boolean;
  // True once all returnable quantity for this item has been confirmed back
  // into stock by a store keeper (see `partReturns`).
  isReturned?: boolean;
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
  supplierId: string;
  supplierName: string;
  supplierContact: string;
  supplierPartCode: string;
  leadTimeDays: number;

  compatibleMachineIds: string[];
  warrantyMonths: number;
  warrantyDocuments: WarrantyDocument[];

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

  // Freeform reason captured when the request isn't linked to a work order
  // (e.g. a technician requesting parts for general/preventive use).
  purpose: string | null;

  isContractorJob: boolean;
  contractorCompany: string | null;

  items: RequestItem[];

  totalEstimatedCost: number;
  totalApprovedCost: number;

  status: RequestStatus;

  storeKeeperReview: StoreKeeperReview | null;
  supervisorReview: SupervisorReview | null;

  // Reason captured when a request is rejected during review.
  rejectionReason?: string | null;

  reservedAt: Timestamp | null;
  issuedAt: Timestamp | null;
  issuedBy: string | null;
  issuedByName: string | null;

  // Physical collection confirmation — captured by the storekeeper when the
  // requesting person (or their delegate) physically collects the parts.
  collectedByName: string | null;
  collectedAt: Timestamp | null;
  confirmedBy: string | null;
  confirmedByName: string | null;

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

  // Set on 'issue' movements — carried over from the request item / manual
  // issue cart line so the physical hand-off is known to be returnable.
  isReturnable?: boolean;
}

export type PartReturnStatus = 'pending' | 'returned' | 'rejected';

// One doc per return event — created when a requester marks an issued,
// returnable item as being handed back, and closed out by a store keeper
// confirming (or rejecting) the physical return.
export interface PartReturn {
  id: string;
  companyId: string;

  partsRequestId: string;
  requestNumber: string;

  partId: string;
  partNumber: string;
  partName: string;
  quantity: number;
  unit: PartUnit;

  requestedBy: string;
  requestedByName: string;
  requestedAt: Timestamp;

  status: PartReturnStatus;

  storeKeeperConfirmedBy: string | null;
  storeKeeperConfirmedByName: string | null;
  storeKeeperConfirmedAt: Timestamp | null;

  notes: string;

  // Snapshot of the originating request's context so the store keeper sees
  // full history without an extra join.
  workOrderId: string | null;
  workOrderNumber: string | null;
  machineId: string | null;
  machineName: string | null;
  issuedAt: Timestamp | null;
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
  approvedByRole?: string | null;
  approvedAt?: Timestamp | null;
  rejectedReason?: string | null;

  sentAt: Timestamp | null;
  invoiceReceivedAt?: Timestamp | null;
  acknowledgedAt: Timestamp | null;
  receivedAt: Timestamp | null;

  cancelledBy?: string | null;
  cancelledByName?: string | null;
  cancelledAt?: Timestamp | null;
  cancelledReason?: string | null;

  notes: string;
  attachments: { name: string; url: string }[];

  // Set once the supplier's invoice is uploaded (status → invoice_received).
  // The invoice document itself is stored as an entry in `attachments`.
  invoiceUploadedBy?: string | null;
  invoiceUploadedByName?: string | null;

  // One entry per time the invoice was reviewed and a priced PO email was
  // sent to the supplier — whether accepted as-is or edited. Lets the
  // "edit again → new priced email" loop happen any number of times while
  // keeping a full audit trail of what price each revision used.
  invoiceRevisions?: {
    revisedAt: Timestamp;
    revisedBy: string;
    revisedByName: string;
    items: { partId: string; partNumber: string; partName: string; unitCost: number; totalCost: number }[];
    totalOrderValue: number;
  }[];

  // One entry per "Confirm Receipt" submission against this PO.
  receiptHistory?: {
    receivedAt: Timestamp;
    receivedBy: string;
    receivedByName: string;
    receiveDate: string;
    deliveryRef: string;
    notes: string;
  }[];
}

export interface Supplier {
  id: string;
  companyId: string;
  // Auto-generated on creation (manual, CSV import, or from a parts
  // import) — e.g. "SUP-000001". Never user-entered.
  supplierCode: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  website: string;
  paymentMethod: string;
  bankDetails: string;
  notes: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
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
  supplierId: string;
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
  supplierContactPerson: string;
  supplierEmail: string;
  supplierAddress: string;
  supplierCountry: string;
  supplierWebsite: string;
  supplierPaymentMethod: string;
  supplierBankDetails: string;
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
