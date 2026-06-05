import { z } from 'zod';
import type { PartCategory, PartUnit, PartStatus, PartCriticality, ReviewDecision, InventoryCurrency } from '@/types/inventory';

const VALID_UNITS = ['pcs','set','kg','g','L','mL','m','cm','box','roll','pair','bag','drum'] as const;
const VALID_CATEGORIES = ['bearings','belts_chains','bolts_fasteners','electrical','filters','gaskets_seals','gears_sprockets','hydraulic','lubricants_oils','motors_drives','pneumatic','pumps_valves','safety_equipment','sensors_instrumentation','welding_supplies','other'] as const;

export const createPartSchema = z.object({
  partNumber: z.string().min(1, 'Part number is required').max(50, 'Part number too long'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').default(''),
  brand: z.string().max(100).default(''),
  modelRef: z.string().max(100).default(''),
  category: z.enum(VALID_CATEGORIES as unknown as [PartCategory, ...PartCategory[]], { required_error: 'Category is required' }),
  unit: z.enum(VALID_UNITS as unknown as [PartUnit, ...PartUnit[]], { required_error: 'Unit is required' }),
  status: z.enum(['active', 'inactive', 'discontinued'] as [PartStatus, ...PartStatus[]]).default('active'),
  criticality: z.enum(['critical', 'high', 'medium', 'low'] as [PartCriticality, ...PartCriticality[]]).default('medium'),
  currentStock: z.number({ invalid_type_error: 'Must be a number' }).min(0, 'Cannot be negative').default(0),
  minStockLevel: z.number({ invalid_type_error: 'Must be a number' }).min(0, 'Cannot be negative').default(0),
  maxStockLevel: z.number({ invalid_type_error: 'Must be a number' }).min(0, 'Cannot be negative').default(0),
  unitCost: z.number({ invalid_type_error: 'Must be a number' }).min(0, 'Cannot be negative').default(0),
  storeLocation: z.string().max(100).default(''),
  supplierName: z.string().max(100).default(''),
  supplierContact: z.string().max(100).default(''),
  supplierPartCode: z.string().max(100).default(''),
  leadTimeDays: z.number({ invalid_type_error: 'Must be a number' }).min(0).int().default(0),
  lastPurchaseDate: z.string().nullable().default(null),
  lastPurchasePrice: z.number({ invalid_type_error: 'Must be a number' }).min(0).default(0),
  warrantyMonths: z.number({ invalid_type_error: 'Must be a number' }).min(0).int().default(0),
  compatibleMachineIds: z.array(z.string()).default([]),
  notes: z.string().max(1000).default(''),
}).refine(
  (data) => data.maxStockLevel === 0 || data.maxStockLevel >= data.minStockLevel,
  { message: 'Max stock level must be ≥ min stock level', path: ['maxStockLevel'] }
);

export type CreatePartFormValues = z.infer<typeof createPartSchema>;

export const receiveStockSchema = z.object({
  poId: z.string().optional(),
  items: z.array(z.object({
    partId: z.string().min(1, 'Part ID required'),
    partNumber: z.string().min(1),
    partName: z.string().min(1),
    unit: z.enum(VALID_UNITS as unknown as [PartUnit, ...PartUnit[]]),
    quantityReceived: z.number().min(0.001, 'Must be greater than 0'),
    unitCost: z.number().min(0),
    condition: z.enum(['good', 'damaged', 'wrong_item']).default('good'),
    notes: z.string().default(''),
    poItemId: z.string().optional(),
  })).min(1, 'At least one item is required'),
  receiveDate: z.string().min(1, 'Receive date is required'),
  deliveryReference: z.string().max(100).default(''),
  supplierName: z.string().min(1, 'Supplier name is required').max(100),
  notes: z.string().max(500).default(''),
});

export type ReceiveStockFormValues = z.infer<typeof receiveStockSchema>;

export const purchaseOrderSchema = z.object({
  supplierName: z.string().min(1, 'Supplier name is required').max(100),
  supplierContact: z.string().max(100).default(''),
  supplierContactPerson: z.string().max(100).default(''),
  supplierPhone: z.string().max(40).default(''),
  supplierEmail: z.string().max(120).default('').refine(
    (v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'Invalid email',
  ),
  supplierAddress: z.string().max(300).default(''),
  deliveryAddress: z.string().max(300).default(''),
  paymentTerms: z.string().max(120).default(''),
  currency: z.enum(['LKR', 'USD', 'SGD', 'Other'] as [InventoryCurrency, ...InventoryCurrency[]]).default('LKR'),
  // Items are tracked in component state and validated separately; keep the
  // form schema permissive so save() actually runs and can report a
  // user-friendly "add at least one item" error.
  items: z.array(z.object({
    partId: z.string(),
    partNumber: z.string(),
    partName: z.string(),
    quantityOrdered: z.number(),
    unitCost: z.number(),
    leadTimeDays: z.number().int().default(0),
    expectedDelivery: z.string().nullable().default(null),
  })).default([]),
  notes: z.string().max(500).default(''),
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

export const inventorySettingsSchema = z.object({
  approvalThresholdLKR: z.number().min(0, 'Cannot be negative'),
  defaultCurrency: z.enum(['LKR', 'USD', 'SGD', 'Other'] as [InventoryCurrency, ...InventoryCurrency[]]),
  lowStockAlertEnabled: z.boolean(),
  lowStockNotifyRoles: z.array(z.string()),
  autoReserveOnApproval: z.boolean(),
  requireReturnLog: z.boolean(),
  partNumberPrefix: z.string().min(1, 'Prefix required').max(10, 'Max 10 chars'),
  poNumberPrefix: z.string().min(1, 'Prefix required').max(10, 'Max 10 chars'),
  requestNumberPrefix: z.string().min(1, 'Prefix required').max(10, 'Max 10 chars'),
});

export type InventorySettingsFormValues = z.infer<typeof inventorySettingsSchema>;

export const stockAdjustmentSchema = z.object({
  quantity: z.number({ invalid_type_error: 'Must be a number' }).refine((v) => v !== 0, 'Quantity cannot be zero'),
  notes: z.string().min(1, 'Notes are required for adjustments').max(500),
});

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentSchema>;

export const requestReviewSchema = z.object({
  decision: z.enum(['approve', 'escalate', 'reject', 'partial'] as [ReviewDecision, ...ReviewDecision[]], {
    required_error: 'Decision is required',
  }),
  notes: z.string().max(500).default(''),
  escalationReason: z.string().max(500).default(''),
}).refine(
  (data) => data.decision !== 'escalate' || data.escalationReason.length > 0,
  { message: 'Escalation reason is required when escalating', path: ['escalationReason'] }
).refine(
  (data) => data.decision !== 'reject' || data.notes.length > 0,
  { message: 'Notes are required when rejecting', path: ['notes'] }
);

export type RequestReviewFormValues = z.infer<typeof requestReviewSchema>;
