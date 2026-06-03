import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

export const checklistItemSchema = z.object({
  stepNumber: z.number().int().positive(),
  stepDescription: z.string().min(1, 'Step description is required'),
  assignedTechnicianId: z.string().nullable(),
  assignedTechnicianName: z.string().nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
});

export const partsRequestSchema = z.object({
  partId: z.string().min(1, 'Part is required'),
  partName: z.string().min(1),
  partNumber: z.string(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  currentStock: z.number().default(0).transform((v) => v ?? 0),
  note: z.string().nullable(),
});

export const partUsedSchema = z.object({
  partId: z.string().nullable(),
  partName: z.string().min(1, 'Part name is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  source: z.enum(['stock', 'external']),
  unitCost: z.number().min(0, 'Unit cost cannot be negative'),
  totalCost: z.number().min(0),
  warrantyMonths: z.number().int().positive().nullable(),
});

export const technicianWorkLogSchema = z.object({
  technicianId: z.string().min(1),
  technicianName: z.string().min(1),
  hoursWorked: z.number().positive('Hours worked must be greater than 0'),
  tasksDescription: z.string().min(1, 'Task description is required'),
});

export const contractorHoursLogSchema = z.object({
  hoursOnSite: z.number().min(0),
  hoursBilled: z.number().min(0),
  technicianNames: z.array(z.string()),
  notes: z.string(),
});

export const postRepairChecklistItemSchema = z.object({
  stepDescription: z.string().min(1),
  isCompleted: z.boolean(),
  completedBy: z.string().nullable(),
  completedAt: z.any().nullable(),
  result: z.enum(['pass', 'fail']).nullable(),
  notes: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Create WO Form Schema — Section by section
// ---------------------------------------------------------------------------

export const woSection1Schema = z.object({
  woType: z.enum([
    'BREAKDOWN', 'CORRECTIVE', 'PREVENTIVE', 'INSTALLATION',
    'MODIFICATION', 'INSPECTION', 'CONTRACTOR', 'OTHER',
  ]),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string().min(10, 'Please provide at least 10 characters'),
  dueDate: z.date({ required_error: 'Due date is required' }),
  scheduledStart: z.date().nullable(),
  linkedBreakdownId: z.string().nullable(),
  linkedBreakdownTicketNumber: z.string().nullable(),
});

export const woSection2Schema = z.object({
  machineId: z.string().min(1, 'Machine selection is required'),
  machineName: z.string().min(1),
  machineDepartment: z.string(),
  machineLocation: z.string(),
  machineType: z.string(),
  machineCriticality: z.union([
    z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]),
});

export const woSection3InternalSchema = z.object({
  supervisorInChargeId: z.string().min(1, 'Supervisor is required'),
  supervisorInChargeName: z.string().min(1),
  estimatedDuration: z.number().positive('Must be greater than 0'),
  estimatedDurationUnit: z.enum(['minutes', 'hours', 'days']),
  assignedTechnicianIds: z.array(z.string()),
  assignedTechnicianNames: z.array(z.string()),
  // contractor fields not used
  contractorCompanyId: z.null().default(null),
  contractorCompanyName: z.null().default(null),
  contractorContactPerson: z.null().default(null),
  contractorContactNumber: z.null().default(null),
  contractorTechnicianNames: z.array(z.string()).default([]),
  isManualContractor: z.literal(false).default(false),
});

export const woSection3ContractorSchema = z.object({
  supervisorInChargeId: z.string().min(1, 'Supervisor is required'),
  supervisorInChargeName: z.string().min(1),
  estimatedDuration: z.number().positive('Must be greater than 0'),
  estimatedDurationUnit: z.enum(['minutes', 'hours', 'days']),
  assignedTechnicianIds: z.array(z.string()).default([]),
  assignedTechnicianNames: z.array(z.string()).default([]),
  contractorCompanyId: z.string().nullable(),
  contractorCompanyName: z.string().min(1, 'Contractor company is required'),
  contractorContactPerson: z.string().min(1, 'Contact person is required'),
  contractorContactNumber: z.string().min(1, 'Contact number is required'),
  contractorTechnicianNames: z.array(z.string()),
  isManualContractor: z.boolean(),
});

export const woSection4Schema = z.object({
  checklist: z.array(checklistItemSchema),
});

export const woSection5Schema = z.object({
  documents: z.array(z.instanceof(File)).optional(),
});

export const woSection6Schema = z.object({
  partsRequests: z.array(partsRequestSchema),
});

// Full create WO schema (all sections merged)
export const createWOSchema = woSection1Schema
  .merge(woSection2Schema)
  .merge(
    z.object({
      supervisorInChargeId: z.string().min(1, 'Supervisor is required'),
      supervisorInChargeName: z.string().min(1),
      estimatedDuration: z.number().positive(),
      estimatedDurationUnit: z.enum(['minutes', 'hours', 'days']),
      assignedTechnicianIds: z.array(z.string()),
      assignedTechnicianNames: z.array(z.string()),
      contractorCompanyId: z.string().nullable(),
      contractorCompanyName: z.string().nullable(),
      contractorContactPerson: z.string().nullable(),
      contractorContactNumber: z.string().nullable(),
      contractorTechnicianNames: z.array(z.string()),
      isManualContractor: z.boolean(),
    }),
  )
  .merge(woSection4Schema)
  .merge(woSection6Schema)
  .superRefine((data, ctx) => {
    if (data.woType === 'BREAKDOWN' && !data.linkedBreakdownId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Linked breakdown ticket is required for Breakdown WOs',
        path: ['linkedBreakdownId'],
      });
    }

    if (['PREVENTIVE', 'INSTALLATION', 'INSPECTION'].includes(data.woType) && !data.scheduledStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Scheduled start is required for this WO type',
        path: ['scheduledStart'],
      });
    }

    if (data.woType === 'CONTRACTOR') {
      if (!data.contractorCompanyName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Contractor company name is required',
          path: ['contractorCompanyName'],
        });
      }
      if (!data.contractorContactPerson) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Contractor contact person is required',
          path: ['contractorContactPerson'],
        });
      }
      if (!data.contractorContactNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Contractor contact number is required',
          path: ['contractorContactNumber'],
        });
      }
    }
  });

export type CreateWOFormValues = z.infer<typeof createWOSchema>;

// ---------------------------------------------------------------------------
// Completion Form Schema
// ---------------------------------------------------------------------------

export const completionStep1Schema = z.object({
  actualStartTime: z.date({ required_error: 'Start time is required' }),
  actualEndTime: z.date({ required_error: 'End time is required' }),
  workDoneDescription: z.string().min(20, 'Please describe the work done in detail (min 20 chars)'),
  rootCause: z.enum([
    'wear_and_tear', 'operator_error', 'manufacturing_defect',
    'lack_of_maintenance', 'external_damage', 'unknown',
  ]),
  rootCauseDescription: z.string(),
}).superRefine((data, ctx) => {
  if (data.actualEndTime <= data.actualStartTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End time must be after start time',
      path: ['actualEndTime'],
    });
  }
  if (data.rootCause !== 'unknown' && data.rootCauseDescription.length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please describe the root cause in more detail',
      path: ['rootCauseDescription'],
    });
  }
});

export const completionStep2Schema = z.object({
  partsUsed: z.array(partUsedSchema),
});

export const completionStep3Schema = z.object({
  technicianWorkLogs: z.array(technicianWorkLogSchema).min(1, 'At least one technician log is required'),
  contractorHoursLog: contractorHoursLogSchema.nullable(),
});

export const completionStep4Schema = z.object({
  postRepairChecklist: z.array(postRepairChecklistItemSchema)
    .refine(
      (items) => items.every((i) => i.isCompleted),
      { message: 'All checklist steps must be completed' },
    ),
});

export const completionStep5Schema = z.object({
  testRunResult: z.enum(['pass', 'fail', 'partial']),
  testRunNotes: z.string(),
}).superRefine((data, ctx) => {
  if ((data.testRunResult === 'fail' || data.testRunResult === 'partial') && !data.testRunNotes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Test run notes are required for Fail or Partial results',
      path: ['testRunNotes'],
    });
  }
});

export const completionStep6Schema = z.object({
  finalPhotos: z.array(z.instanceof(File)).min(1, 'At least 1 final photo is required'),
});

export const completionStep7Schema = z.object({
  machineStatusAfterRepair: z.enum(['operational', 'partially_operational', 'still_down']),
  updatedCADFiles: z.array(z.instanceof(File)).optional(),
  warrantyDocuments: z.array(z.instanceof(File)).optional(),
});

// Completion schema combines all steps — using object() to avoid ZodEffects merge issue
export const woCompletionSchema = z.object({
  actualStartTime: z.date({ required_error: 'Start time is required' }),
  actualEndTime: z.date({ required_error: 'End time is required' }),
  workDoneDescription: z.string().min(20, 'Please describe the work done in detail (min 20 chars)'),
  rootCause: z.enum([
    'wear_and_tear', 'operator_error', 'manufacturing_defect',
    'lack_of_maintenance', 'external_damage', 'unknown',
  ]),
  rootCauseDescription: z.string(),
  partsUsed: z.array(partUsedSchema),
  technicianWorkLogs: z.array(technicianWorkLogSchema).min(1, 'At least one technician log is required'),
  contractorHoursLog: contractorHoursLogSchema.nullable(),
  postRepairChecklist: z.array(postRepairChecklistItemSchema),
  testRunResult: z.enum(['pass', 'fail', 'partial']),
  testRunNotes: z.string(),
  machineStatusAfterRepair: z.enum(['operational', 'partially_operational', 'still_down']),
});

export type WOCompletionFormValues = z.infer<typeof woCompletionSchema>;

// ---------------------------------------------------------------------------
// Sign-Off Schema
// ---------------------------------------------------------------------------

export const signOffSchema = z.object({
  signature: z.string().min(1, 'Signature is required'),
  notes: z.string(),
});

export type SignOffFormValues = z.infer<typeof signOffSchema>;
