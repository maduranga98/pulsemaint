import { describe, expect, it } from 'vitest';
import { isModuleDone } from '../training/programmeProgress';
import type { TrainingAssignment } from '../training/trainingTypes';

const a = (over: Partial<TrainingAssignment>) => ({ traineeId: 't1', moduleId: 'm1', status: 'in_progress', quizPassed: false, ...over }) as TrainingAssignment;

describe('isModuleDone', () => {
  it('is done when the trainee passed the module', () => {
    expect(isModuleDone([a({ quizPassed: true })], 't1', 'm1')).toBe(true);
    expect(isModuleDone([a({ status: 'certified' })], 't1', 'm1')).toBe(true);
  });
  it('is not done while the quiz is not passed', () => {
    expect(isModuleDone([a({ status: 'quiz_failed' })], 't1', 'm1')).toBe(false);
  });
  it('counts a passed re-assignment even when an old failed one comes first', () => {
    expect(isModuleDone([a({ status: 'quiz_failed' }), a({ status: 'quiz_passed', quizPassed: true })], 't1', 'm1')).toBe(true);
  });
  it('ignores other trainees and modules', () => {
    expect(isModuleDone([a({ traineeId: 't2', quizPassed: true }), a({ moduleId: 'm2', quizPassed: true })], 't1', 'm1')).toBe(false);
  });
});

import { isProgramAssignmentReady } from '../training/programmeProgress';

describe('isProgramAssignmentReady', () => {
  const mods = new Map([['a', { overallProgress: 100 }], ['b', { overallProgress: 100 }], ['c', { overallProgress: 60 }]]);
  it('is ready when every module is at 100 %', () => {
    expect(isProgramAssignmentReady({ status: 'in_progress', moduleAssignmentIds: ['a', 'b'] }, mods)).toBe(true);
  });
  it('is not ready while a module is unfinished, missing or already signed off', () => {
    expect(isProgramAssignmentReady({ status: 'in_progress', moduleAssignmentIds: ['a', 'c'] }, mods)).toBe(false);
    expect(isProgramAssignmentReady({ status: 'in_progress', moduleAssignmentIds: [] }, mods)).toBe(false);
    expect(isProgramAssignmentReady({ status: 'signed_off', moduleAssignmentIds: ['a'] }, mods)).toBe(false);
  });
});
