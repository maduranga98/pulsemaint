import { z } from 'zod';

const triageStepOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Option label is required'),
  nextStepId: z.string().nullable(),
  isEscalate: z.boolean(),
  isSafe: z.boolean(),
  translations: z.record(z.object({ label: z.string() })).optional(),
});

const triageChecklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, 'Checklist item text is required'),
  required: z.boolean(),
});

const triageMediaRefSchema = z.object({
  type: z.enum(['image', 'video']),
  url: z.string().url('Must be a valid URL'),
  caption: z.string(),
});

const triageStepTranslationSchema = z.object({
  title: z.string(),
  instruction: z.string(),
});

export const triageStepSchema = z.object({
  id: z.string().min(1),
  stepNumber: z.number().int().positive(),
  phase: z.enum(['safety', 'assessment', 'safe_action', 'document', 'wait']),
  title: z.string().min(1, 'Step title is required'),
  instruction: z.string().min(1, 'Step instruction is required'),
  type: z.enum([
    'statement',
    'yes_no',
    'multiple_choice',
    'photo_required',
    'number_input',
    'text_input',
    'checklist',
  ]),
  options: z.array(triageStepOptionSchema),
  checklistItems: z.array(triageChecklistItemSchema),
  mediaRefs: z.array(triageMediaRefSchema),
  safetyLevel: z.enum(['safe', 'caution', 'danger']),
  isEscalationStep: z.boolean(),
  isQuickFixStep: z.boolean(),
  requiresPhoto: z.boolean(),
  requiresConfirmation: z.boolean(),
  translations: z.record(triageStepTranslationSchema),
  estimatedSeconds: z.number().int().nonnegative(),
  fieldLabel: z.string().optional(),
  unit: z.string().optional(),
  normalMin: z.number().optional(),
  normalMax: z.number().optional(),
  placeholder: z.string().optional(),
  maxChars: z.number().int().positive().optional(),
});

export const triageEmergencyContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  role: z.string().min(1, 'Role is required'),
});

export const triageFlowFormSchema = z.object({
  name: z.string().min(1, 'Flow name is required').max(100),
  description: z.string().max(500),
  machineTypeId: z.string().nullable(),
  specificMachineId: z.string().nullable(),
  language: z.enum(['en', 'si', 'ta', 'bn']),
  isActive: z.boolean(),
  steps: z.array(triageStepSchema),
  emergencyContacts: z.array(triageEmergencyContactSchema),
  machineShutdownProcedure: z.string(),
  totalEstimatedMinutes: z.number().nonnegative(),
});

export type TriageFlowFormValues = z.infer<typeof triageFlowFormSchema>;
export type TriageStepFormValues = z.infer<typeof triageStepSchema>;
