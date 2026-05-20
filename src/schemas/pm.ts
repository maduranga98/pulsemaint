import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

export const pmChecklistItemSchema = z.object({
  step: z.number().int().positive(),
  description: z.string().min(1, 'Step description is required'),
  estimatedMinutes: z.number().int().min(1, 'Must be at least 1 minute'),
  photoRequired: z.boolean(),
});

export const pmPreallocatedPartSchema = z.object({
  partId: z.string().min(1, 'Part is required'),
  partName: z.string().min(1),
  partNumber: z.string(),
  quantity: z.number().positive('Quantity must be greater than 0'),
});

export const pmDocumentSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  type: z.string(),
  size: z.number(),
});

// ---------------------------------------------------------------------------
// PM Schedule Form — Section by section
// ---------------------------------------------------------------------------

export const pmSection1Schema = z.object({
  name: z.string().min(2, 'Schedule name is required'),
  pmType: z.enum([
    'lubrication', 'inspection', 'calibration', 'filter_replacement',
    'belt_chain_check', 'full_service', 'electrical_check',
    'hydraulic_service', 'safety_inspection', 'other',
  ]),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string(),
});

export const pmSection2Schema = z.object({
  machineId: z.string().min(1, 'Machine selection is required'),
  machineName: z.string().min(1),
  machineCriticality: z.number().int().min(1).max(5),
  department: z.string(),
  location: z.string(),
});

export const pmSection3CalendarSchema = z.object({
  triggerType: z.literal('calendar'),
  firstDueDate: z.date({ required_error: 'First PM date is required' }),
  recurrenceType: z.enum([
    'daily', 'weekly', 'biweekly', 'monthly', 'quarterly',
    'semi_annual', 'annual', 'custom',
  ]),
  customIntervalDays: z.number().int().positive().nullable(),
  endDate: z.date().nullable(),
  noEndDate: z.boolean().default(false),
  seasonalOverride: z.boolean().default(false),
  peakSeasonStart: z.date().nullable(),
  peakSeasonEnd: z.date().nullable(),
  peakSeasonInterval: z.string().nullable(),
});

export const pmSection3UsageSchema = z.object({
  triggerType: z.literal('usage'),
  triggerAfterValue: z.number().positive('Trigger value must be greater than 0'),
  triggerUnit: z.enum(['operating_hours', 'production_cycles']),
  currentMeterValue: z.number().min(0).nullable(),
  lastMeterResetDate: z.date().nullable(),
  // calendar fields not used
  firstDueDate: z.date().nullable().default(null),
  recurrenceType: z.enum([
    'daily', 'weekly', 'biweekly', 'monthly', 'quarterly',
    'semi_annual', 'annual', 'custom',
  ]).default('monthly'),
  customIntervalDays: z.number().nullable().default(null),
  endDate: z.date().nullable().default(null),
  noEndDate: z.boolean().default(true),
  seasonalOverride: z.boolean().default(false),
  peakSeasonStart: z.date().nullable().default(null),
  peakSeasonEnd: z.date().nullable().default(null),
  peakSeasonInterval: z.string().nullable().default(null),
});

export const pmSection4Schema = z.object({
  assignedTechnicianIds: z.array(z.string()),
  assignedTechnicianNames: z.array(z.string()),
  estimatedDuration: z.number().positive('Must be greater than 0'),
  estimatedDurationUnit: z.enum(['hours', 'days']),
  skillsRequired: z.array(z.string()),
});

export const pmSection5Schema = z.object({
  checklistItems: z.array(pmChecklistItemSchema).min(1, 'At least one checklist step is required'),
  checklistTemplateId: z.string().nullable(),
});

export const pmSection6Schema = z.object({
  preallocatedParts: z.array(pmPreallocatedPartSchema),
});

export const pmSection7Schema = z.object({
  documents: z.array(z.instanceof(File)).optional(),
});

export const pmSection8Schema = z.object({
  leadTimeDays: z.number().int().min(0).default(1),
  overdueEscalationHours: z.number().int().positive().default(24),
  autoCloseAfterDays: z.number().int().positive().default(3),
});

// Full create PM schema (all sections merged)
export const createPMSchema = pmSection1Schema
  .merge(pmSection2Schema)
  .merge(
    z.object({
      triggerType: z.enum(['calendar', 'usage']),
      firstDueDate: z.date().nullable(),
      recurrenceType: z.enum([
        'daily', 'weekly', 'biweekly', 'monthly', 'quarterly',
        'semi_annual', 'annual', 'custom',
      ]),
      customIntervalDays: z.number().int().positive().nullable(),
      endDate: z.date().nullable(),
      noEndDate: z.boolean(),
      seasonalOverride: z.boolean(),
      peakSeasonStart: z.date().nullable(),
      peakSeasonEnd: z.date().nullable(),
      peakSeasonInterval: z.string().nullable(),
      triggerAfterValue: z.number().positive().nullable(),
      triggerUnit: z.enum(['operating_hours', 'production_cycles']).nullable(),
      currentMeterValue: z.number().min(0).nullable(),
      lastMeterResetDate: z.date().nullable(),
    }),
  )
  .merge(pmSection4Schema)
  .merge(pmSection5Schema)
  .merge(pmSection6Schema)
  .merge(pmSection8Schema)
  .superRefine((data, ctx) => {
    if (data.triggerType === 'calendar') {
      if (!data.firstDueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'First due date is required for calendar-based schedules',
          path: ['firstDueDate'],
        });
      }
      if (data.recurrenceType === 'custom' && (!data.customIntervalDays || data.customIntervalDays < 1)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Custom interval days must be at least 1',
          path: ['customIntervalDays'],
        });
      }
      if (!data.noEndDate && data.endDate && data.firstDueDate && data.endDate <= data.firstDueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date must be after first due date',
          path: ['endDate'],
        });
      }
      if (data.seasonalOverride) {
        if (!data.peakSeasonStart || !data.peakSeasonEnd) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Peak season start and end dates are required',
            path: ['peakSeasonStart'],
          });
        }
        if (data.peakSeasonStart && data.peakSeasonEnd && data.peakSeasonEnd <= data.peakSeasonStart) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Peak season end must be after start',
            path: ['peakSeasonEnd'],
          });
        }
      }
    }

    if (data.triggerType === 'usage') {
      if (!data.triggerAfterValue || data.triggerAfterValue <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Trigger after value is required for usage-based schedules',
          path: ['triggerAfterValue'],
        });
      }
      if (!data.triggerUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Trigger unit is required for usage-based schedules',
          path: ['triggerUnit'],
        });
      }
    }

    if (data.assignedTechnicianIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one technician must be assigned',
        path: ['assignedTechnicianIds'],
      });
    }
  });

export type CreatePMFormValues = z.infer<typeof createPMSchema>;

// ---------------------------------------------------------------------------
// Meter update schema
// ---------------------------------------------------------------------------

export const updateMeterSchema = z.object({
  currentMeterValue: z.number().min(0, 'Meter value cannot be negative'),
  lastMeterResetDate: z.date().nullable(),
});

export type UpdateMeterFormValues = z.infer<typeof updateMeterSchema>;

export const pmDocumentFileSchema = z.array(z.instanceof(File)).optional().default([]);
export type PMDocumentFileValues = z.infer<typeof pmDocumentFileSchema>;
