import { describe, it, expect } from 'vitest';
import {
  trainingLibraryModuleSchema,
  traineeLibraryModuleSchema,
} from '../training/trainingValidation';

const trainingBase = {
  title: 'Plant Safety Induction',
  category: 'machine' as const,
  machineName: 'Plant-wide',
};

const traineeBase = {
  title: 'Electrical Trainee Orientation',
  trainingType: 'electrical_trainee' as const,
  trainingMode: 'onsite' as const,
  defaultTrainingPeriodMonths: 6,
};

describe('trainingLibraryModuleSchema (Training tab library)', () => {
  it('accepts an internal machine module and defaults its libraryScope', () => {
    const parsed = trainingLibraryModuleSchema.parse(trainingBase);
    expect(parsed.libraryScope).toBe('training');
    expect(parsed.machineName).toBe('Plant-wide');
  });

  it('requires a machine for internal training modules', () => {
    const result = trainingLibraryModuleSchema.safeParse({ ...trainingBase, machineName: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['machineName']);
    }
  });

  it('does not require a machine for offboard/external modules', () => {
    const result = trainingLibraryModuleSchema.safeParse({
      title: 'Vendor Certification',
      category: 'offboard',
      machineName: '',
      providerName: 'Acme Training Ltd',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a module claiming the trainee library scope', () => {
    const result = trainingLibraryModuleSchema.safeParse({
      ...trainingBase,
      libraryScope: 'trainee_management',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a title-less module', () => {
    expect(trainingLibraryModuleSchema.safeParse({ ...trainingBase, title: '' }).success).toBe(false);
  });
});

describe('traineeLibraryModuleSchema (Trainee Management library)', () => {
  it('accepts a fully specified programme module and defaults its libraryScope', () => {
    const parsed = traineeLibraryModuleSchema.parse(traineeBase);
    expect(parsed.libraryScope).toBe('trainee_management');
    expect(parsed.defaultTrainingPeriodMonths).toBe(6);
  });

  it('requires a training type', () => {
    const { trainingType, ...withoutType } = traineeBase;
    expect(trainingType).toBeDefined();
    expect(traineeLibraryModuleSchema.safeParse(withoutType).success).toBe(false);
  });

  it('requires a delivery mode', () => {
    const { trainingMode, ...withoutMode } = traineeBase;
    expect(trainingMode).toBeDefined();
    expect(traineeLibraryModuleSchema.safeParse(withoutMode).success).toBe(false);
  });

  it('requires a default training period between 1 and 60 months', () => {
    expect(
      traineeLibraryModuleSchema.safeParse({ ...traineeBase, defaultTrainingPeriodMonths: 0 }).success
    ).toBe(false);
    expect(
      traineeLibraryModuleSchema.safeParse({ ...traineeBase, defaultTrainingPeriodMonths: 61 }).success
    ).toBe(false);
    expect(
      traineeLibraryModuleSchema.safeParse({ ...traineeBase, defaultTrainingPeriodMonths: 12 }).success
    ).toBe(true);
  });

  it('rejects a module claiming the training library scope', () => {
    const result = traineeLibraryModuleSchema.safeParse({
      ...traineeBase,
      libraryScope: 'training',
    });
    expect(result.success).toBe(false);
  });
});
