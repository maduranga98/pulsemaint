import { z } from 'zod';

export const shiftConfigSchema = z.object({
  shiftName: z.string().trim().min(2, 'Shift name is required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Choose a valid hex color'),
  activeDays: z.array(z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])).min(1, 'Select at least one day'),
  department: z.string().trim().nullable(),
  status: z.enum(['active', 'inactive']),
});

export const watchFlagSchema = z.object({
  machineId: z.string().min(1, 'Machine is required'),
  machineName: z.string().min(1),
  machineLocation: z.string(),
  watchLevel: z.enum(['critical_watch', 'monitor', 'info_only']),
  reason: z.string().trim().min(3, 'Watch reason is required'),
  recommendedAction: z.string().trim().min(2, 'Recommended action is required'),
  linkedBreakdownId: z.string().nullable(),
});

export const pendingWOSnapshotSchema = z.object({
  woId: z.string(),
  woNumber: z.string(),
  machineName: z.string(),
  woType: z.string(),
  priority: z.string(),
  currentStatus: z.string(),
  assignedTechnician: z.string(),
  dueDate: z.date().nullable(),
  supervisorNote: z.string(),
  carryForwardStatus: z.enum(['continue', 'escalate', 'on_hold']),
});

export const ongoingBreakdownSnapshotSchema = z.object({
  ticketId: z.string(),
  ticketNumber: z.string(),
  machineName: z.string(),
  severity: z.string(),
  currentState: z.string(),
  timeElapsedMinutes: z.number().min(0),
  assignedTechnician: z.string(),
  supervisorNote: z.string(),
  nextShiftPriority: z.enum(['urgent', 'continue', 'monitor']),
});

export const draftHandoverSchema = z.object({
  shiftConfigId: z.string().min(1),
  shiftName: z.string().min(1),
  shiftActualStart: z.date(),
  watchFlags: z.array(watchFlagSchema),
  pendingWOs: z.array(pendingWOSnapshotSchema),
  ongoingBreakdowns: z.array(ongoingBreakdownSnapshotSchema),
  partsNotes: z.string().max(2000),
  lowStockAlerts: z.array(z.object({
    partId: z.string(),
    partName: z.string(),
    currentQty: z.number(),
    minQty: z.number(),
  })),
  safetyIncidentOccurred: z.boolean(),
  safetyIncidentDescription: z.string().max(2000),
  restrictedAreas: z.string().max(1000),
  temporaryRepairs: z.string().max(1000),
  generalNotes: z.string().max(2000),
  outgoingAcknowledged: z.literal(true, {
    errorMap: () => ({ message: 'Acknowledge that the handover is accurate and complete.' }),
  }),
});

export type ShiftConfigFormValues = z.infer<typeof shiftConfigSchema>;
export type DraftHandoverValues = z.infer<typeof draftHandoverSchema>;
export type WatchFlagFormValues = z.infer<typeof watchFlagSchema>;
