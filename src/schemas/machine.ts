import { z } from 'zod';

// ---------------------------------------------------------------------------
// Individual Field Schemas
// ---------------------------------------------------------------------------

const machineNameSchema = z
  .string()
  .min(1, 'Machine name is required')
  .max(100, 'Machine name must not exceed 100 characters');

const machineTypeSchema = z.enum([
  'cnc_machine',
  'conveyor',
  'compressor',
  'boiler',
  'generator',
  'hydraulic_press',
  'pump',
  'motor',
  'crane',
  'lathe',
  'milling_machine',
  'welding_machine',
  'hvac',
  'other',
] as const);

const manufacturerSchema = z
  .string()
  .min(1, 'Manufacturer is required')
  .max(100, 'Manufacturer name is too long');

const modelSchema = z
  .string()
  .max(100, 'Model is too long')
  .optional()
  .or(z.literal(''));

const serialNumberSchema = z
  .string()
  .max(100, 'Serial number is too long')
  .optional()
  .or(z.literal(''));

const departmentSchema = z
  .string()
  .min(1, 'Department is required')
  .max(100, 'Department name is too long');

const locationFieldSchema = z
  .string()
  .max(100, 'Location field is too long')
  .optional()
  .or(z.literal(''));

const statusSchema = z.enum(['active', 'under_maintenance', 'decommissioned'] as const);

const criticalitySchema = z
  .number()
  .int()
  .min(1, 'Criticality must be between 1 and 5')
  .max(5, 'Criticality must be between 1 and 5');

const healthScoreSchema = z
  .number()
  .int()
  .min(0, 'Health score must be between 0 and 100')
  .max(100, 'Health score must be between 0 and 100')
  .optional()
  .default(100);

const lifespanSchema = z
  .number()
  .int()
  .min(1, 'Expected lifespan must be at least 1 year')
  .max(100, 'Expected lifespan cannot exceed 100 years')
  .nullable()
  .optional();

const documentTypeSchema = z.enum([
  'manual',
  'schematic',
  'warranty',
  'certificate',
  'sop',
  'photo',
  'other',
] as const);

const noteSchema = z
  .string()
  .max(500, 'Notes must not exceed 500 characters')
  .nullable()
  .optional();

// ---------------------------------------------------------------------------
// File Validation
// ---------------------------------------------------------------------------

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const PHOTO_MAX_SIZE = 50 * 1024 * 1024; // 50MB

const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/vnd.autodesk.autocad.drawing',
  'application/vnd.autodesk.autocad.dxf',
  'application/step',
  'model/step',
  'model/stl',
];
const DOCUMENT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

const photoFileSchema = z.instanceof(File).refine(
  (file) => PHOTO_MIME_TYPES.includes(file.type),
  'Photo must be JPG, PNG, WEBP, or HEIC format'
).refine(
  (file) => file.size <= PHOTO_MAX_SIZE,
  `Photo must not exceed ${PHOTO_MAX_SIZE / (1024 * 1024)}MB`
);

const documentFileSchema = z.instanceof(File).refine(
  (file) => DOCUMENT_MIME_TYPES.includes(file.type),
  'Document type not supported'
).refine(
  (file) => file.size <= DOCUMENT_MAX_SIZE,
  `Document must not exceed ${DOCUMENT_MAX_SIZE / (1024 * 1024)}MB`
);

// ---------------------------------------------------------------------------
// Create Machine Form Schema
// ---------------------------------------------------------------------------

const warrantyItemSchema = z.object({
  partName: z.string().min(1, 'Part name is required').max(200),
  expiryDate: z.date({ required_error: 'Expiry date is required' }),
  supplierWarrantyRef: z.string().max(200).optional().default(''),
});

export const createMachineSchema = z.object({
  name: machineNameSchema,
  type: machineTypeSchema,
  manufacturer: manufacturerSchema,
  model: modelSchema,
  serialNumber: serialNumberSchema,
  purchaseDate: z.date().nullable().optional(),
  installationDate: z.date().nullable().optional(),
  nextPmDue: z.date().nullable().optional(),
  expectedLifespanYears: lifespanSchema,
  department: departmentSchema,
  floor: locationFieldSchema,
  bay: locationFieldSchema,
  station: locationFieldSchema,
  status: statusSchema,
  criticality: criticalitySchema,
  healthScore: healthScoreSchema,
  warrantyItems: z.array(warrantyItemSchema).optional().default([]),
  photoFiles: z.array(photoFileSchema).optional().default([]),
  documentFiles: z.array(
    z.object({
      file: documentFileSchema,
      type: documentTypeSchema,
      name: z.string().min(1, 'Document name is required').max(100),
    })
  ).optional().default([]),
  compatiblePartIds: z.array(z.string()).optional().default([]),
  modificationNotes: noteSchema,
  additionalNotes: noteSchema,
});

export type CreateMachineFormData = z.infer<typeof createMachineSchema>;

// ---------------------------------------------------------------------------
// Edit Machine Form Schema
// ---------------------------------------------------------------------------

export const updateMachineSchema = z.object({
  name: machineNameSchema.optional(),
  type: machineTypeSchema.optional(),
  manufacturer: manufacturerSchema.optional(),
  model: modelSchema,
  serialNumber: serialNumberSchema,
  purchaseDate: z.date().nullable().optional(),
  installationDate: z.date().nullable().optional(),
  nextPmDue: z.date().nullable().optional(),
  expectedLifespanYears: lifespanSchema,
  department: departmentSchema.optional(),
  floor: locationFieldSchema,
  bay: locationFieldSchema,
  station: locationFieldSchema,
  status: statusSchema.optional(),
  criticality: criticalitySchema.optional(),
  healthScore: healthScoreSchema.optional(),
  warrantyItems: z.array(warrantyItemSchema).optional(),
  photoFiles: z.array(photoFileSchema).optional(),
  documentFiles: z.array(
    z.object({
      file: documentFileSchema,
      type: documentTypeSchema,
      name: z.string().min(1, 'Document name is required').max(100),
    })
  ).optional(),
  compatiblePartIds: z.array(z.string()).optional(),
  modificationNotes: noteSchema,
  additionalNotes: noteSchema,
});

export type UpdateMachineFormData = z.infer<typeof updateMachineSchema>;

// ---------------------------------------------------------------------------
// Search & Filter Schema
// ---------------------------------------------------------------------------

export const machineFiltersSchema = z.object({
  search: z.string().optional().default(''),
  departments: z.array(z.string()).optional().default([]),
  statuses: z.array(z.enum(['active', 'under_maintenance', 'decommissioned'])).optional().default([]),
  criticalities: z.array(z.number().min(1).max(5)).optional().default([]),
  healthScoreMin: z.number().min(0).max(100).optional().default(0),
  healthScoreMax: z.number().min(0).max(100).optional().default(100),
});

export type MachineFiltersData = z.infer<typeof machineFiltersSchema>;
