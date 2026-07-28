import { describe, it, expect } from 'vitest';
import {
  sampleTrainingModules,
  SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS,
} from '../training/sampleTrainingModules';

describe('sampleTrainingModules', () => {
  const modules = sampleTrainingModules();

  it('provides exactly six trainee-category modules', () => {
    expect(modules).toHaveLength(6);
    const types = modules.map((m) => m.trainingType);
    expect(new Set(types).size).toBe(6);
    expect(types).toEqual(
      expect.arrayContaining([
        'electrical_trainee',
        'mechanical_trainee',
        'hr_trainee',
        'civil_trainee',
        'technician_trainee',
        'operator_trainee',
      ]),
    );
  });

  it('defaults every sample module to a 6-month training period', () => {
    expect(SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS).toBe(6);
    for (const m of modules) {
      expect(m.defaultTrainingPeriodMonths).toBe(6);
    }
  });

  it('gives each module lessons, a practice quiz, and a final test', () => {
    for (const m of modules) {
      expect(m.lessons.length).toBeGreaterThan(0);
      expect(m.quiz.questions.length).toBeGreaterThan(0);
      expect(m.finalTest.questions.length).toBeGreaterThan(0);
      expect(m.finalTest.isFinalTest).toBe(true);
      expect(m.quiz.isFinalTest).toBeFalsy();
    }
  });

  it('has distinct, category-flavored lesson titles across modules (not duplicated content)', () => {
    const allTitles = modules.flatMap((m) => m.lessons.map((l) => l.title));
    expect(new Set(allTitles).size).toBe(allTitles.length);
  });
});
