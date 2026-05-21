import { z } from 'zod';

// ---------------------------------------------------------------------------
// Create Training Module
// ---------------------------------------------------------------------------

export const createTrainingModuleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  machineName: z.string().min(1, 'Machine name is required'),
  machineId: z.string().optional(),
  machineTypeId: z.string().optional(),
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
});

export type CreateTrainingModuleInput = z.infer<typeof createTrainingModuleSchema>;

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
