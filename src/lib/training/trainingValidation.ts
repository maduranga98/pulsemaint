import { z } from 'zod';

// ---------------------------------------------------------------------------
// Create Training Module
// ---------------------------------------------------------------------------

export const createTrainingModuleSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional().default(''),
    moduleCategory: z.enum(['machine', 'offboard_external']).default('machine'),
    machineName: z.string().optional().default(''),
    machineId: z.string().optional(),
    machineTypeId: z.string().optional(),
    providerName: z.string().optional().default(''),
    providerContact: z.string().optional().default(''),
    trainingLocation: z.string().optional().default(''),
    externalCertificateUrl: z.string().optional().default(''),
    estimatedMinutes: z.number().int().positive().default(30),
    passingScore: z
      .number()
      .int()
      .min(50, 'Passing score must be at least 50')
      .max(100, 'Passing score cannot exceed 100')
      .default(70),
    status: z.enum(['draft', 'active', 'archived']).default('draft'),
    language: z.enum(['en', 'si', 'ta', 'bn']).default('en'),
    tags: z.array(z.string()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.moduleCategory === 'machine' && !data.machineName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Machine name is required for machine-specific modules',
        path: ['machineName'],
      });
    }
    if (data.moduleCategory === 'offboard_external' && !data.providerName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provider / institution name is required for offboard & external training',
        path: ['providerName'],
      });
    }
  });

export type CreateTrainingModuleInput = z.infer<typeof createTrainingModuleSchema>;

// ---------------------------------------------------------------------------
// Per-library module validation
//
// The two module libraries require different things of an author, so each
// validates its own shape rather than sharing one permissive schema:
//   • Training tab       — machine/competency modules, Internal vs Offboard.
//   • Trainee Management — programme modules: training type, delivery mode,
//                          and a default training period are all mandatory.
// ---------------------------------------------------------------------------

const moduleCoreShape = {
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  estimatedMinutes: z.number().int().positive().default(30),
  passingScore: z
    .number()
    .int()
    .min(50, 'Passing score must be at least 50')
    .max(100, 'Passing score cannot exceed 100')
    .default(70),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  language: z.enum(['en', 'si', 'ta', 'bn']).default('en'),
  tags: z.array(z.string()).optional().default([]),
};

/** Validates a module authored in the Training tab's library. */
export const trainingLibraryModuleSchema = z
  .object({
    ...moduleCoreShape,
    libraryScope: z.literal('training').default('training'),
    category: z.enum(['machine', 'offboard']).default('machine'),
    machineName: z.string().optional().default(''),
    providerName: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'machine' && !data.machineName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Machine is required for internal training modules',
        path: ['machineName'],
      });
    }
  });

export type TrainingLibraryModuleInput = z.infer<typeof trainingLibraryModuleSchema>;

/** Validates a module authored in Trainee Management's library. */
export const traineeLibraryModuleSchema = z.object({
  ...moduleCoreShape,
  libraryScope: z.literal('trainee_management').default('trainee_management'),
  trainingType: z.enum([
    'electrical_trainee',
    'mechanical_trainee',
    'hr_trainee',
    'civil_trainee',
    'technician_trainee',
    'operator_trainee',
    'safety_training',
    'other_trainee',
  ], { errorMap: () => ({ message: 'Training type is required' }) }),
  trainingMode: z.enum(['online', 'onsite'], {
    errorMap: () => ({ message: 'Mode is required' }),
  }),
  defaultTrainingPeriodMonths: z
    .number()
    .int()
    .min(1, 'Default period must be at least 1 month')
    .max(60, 'Default period must be 60 months or fewer'),
});

export type TraineeLibraryModuleInput = z.infer<typeof traineeLibraryModuleSchema>;

// ---------------------------------------------------------------------------
// Create Assignment
// ---------------------------------------------------------------------------

export const createAssignmentSchema = z.object({
  traineeIds: z.array(z.string()).min(1, 'At least one trainee is required'),
  moduleIds: z.array(z.string()).min(1, 'At least one module is required'),
  dueDate: z.string().optional(),
  isRetraining: z.boolean().default(false),
  retrainingReason: z.string().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

// ---------------------------------------------------------------------------
// Quiz Question
// ---------------------------------------------------------------------------

export const quizOptionSchema = z.object({
  id: z.string().min(1, 'Option ID is required'),
  text: z.string().min(1, 'Option text is required'),
  isCorrect: z.boolean(),
  explanation: z.string().optional().default(''),
});

export const quizQuestionSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  type: z.enum(['single_choice', 'multiple_choice', 'true_false']),
  options: z
    .array(quizOptionSchema)
    .min(2, 'A question must have at least 2 options'),
  points: z.number().int().min(1, 'Points must be at least 1').default(1),
  explanation: z.string().optional().default(''),
});

export type QuizQuestionInput = z.infer<typeof quizQuestionSchema>;

// ---------------------------------------------------------------------------
// Practical Sign-Off
// ---------------------------------------------------------------------------

export const practicalSignOffSchema = z.object({
  passed: z.boolean(),
  observations: z
    .string()
    .min(10, 'Observations must be at least 10 characters'),
  signedOffBy: z.string().min(1, 'Signed-off-by user ID is required'),
  signedOffByName: z.string().min(1, 'Signed-off-by name is required'),
});

export type PracticalSignOffInput = z.infer<typeof practicalSignOffSchema>;
