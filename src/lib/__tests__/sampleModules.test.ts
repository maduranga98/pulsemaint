import { describe, it, expect } from 'vitest';
import {
  sampleTraineeProgrammeModules,
  sampleTrainingLibraryModules,
  SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS,
} from '../training/sampleModules';

describe('sampleTraineeProgrammeModules (Trainee Management library)', () => {
  const modules = sampleTraineeProgrammeModules();

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

  it('sets a delivery mode on every module, as the trainee editor requires', () => {
    for (const m of modules) {
      expect(['online', 'onsite']).toContain(m.trainingMode);
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

describe('sampleTrainingLibraryModules (Training tab library)', () => {
  const modules = sampleTrainingLibraryModules();

  it('provides plant-wide workforce modules', () => {
    expect(modules.length).toBeGreaterThan(0);
    for (const m of modules) {
      expect(m.title.trim()).not.toBe('');
      expect(m.machineName.trim()).not.toBe('');
    }
  });

  it('carries no trainee-programme fields', () => {
    for (const m of modules) {
      expect(m).not.toHaveProperty('trainingType');
      expect(m).not.toHaveProperty('defaultTrainingPeriodMonths');
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

  it('has distinct lesson titles within the set', () => {
    const allTitles = modules.flatMap((m) => m.lessons.map((l) => l.title));
    expect(new Set(allTitles).size).toBe(allTitles.length);
  });
});

describe('the two libraries never share templates', () => {
  const trainingSamples = sampleTrainingLibraryModules();
  const traineeSamples = sampleTraineeProgrammeModules();

  it('shares no module titles', () => {
    const trainingTitles = new Set(trainingSamples.map((m) => m.title));
    for (const m of traineeSamples) {
      expect(trainingTitles.has(m.title)).toBe(false);
    }
  });

  it('shares no lesson titles', () => {
    const trainingLessons = new Set(trainingSamples.flatMap((m) => m.lessons.map((l) => l.title)));
    for (const title of traineeSamples.flatMap((m) => m.lessons.map((l) => l.title))) {
      expect(trainingLessons.has(title)).toBe(false);
    }
  });

  it('shares no quiz titles', () => {
    const trainingQuizzes = new Set(
      trainingSamples.flatMap((m) => [m.quiz.title, m.finalTest.title])
    );
    for (const title of traineeSamples.flatMap((m) => [m.quiz.title, m.finalTest.title])) {
      expect(trainingQuizzes.has(title)).toBe(false);
    }
  });
});
