export * from '../../types/triage';
import type { TriageStep, TriageStepType } from '../../types/triage';

export function isStatementStep(step: TriageStep): boolean {
  return step.type === 'statement';
}

export function isYesNoStep(step: TriageStep): boolean {
  return step.type === 'yes_no';
}

export function isMultipleChoiceStep(step: TriageStep): boolean {
  return step.type === 'multiple_choice';
}

export function isPhotoRequiredStep(step: TriageStep): boolean {
  return step.type === 'photo_required';
}

export function isNumberInputStep(step: TriageStep): boolean {
  return step.type === 'number_input';
}

export function isTextInputStep(step: TriageStep): boolean {
  return step.type === 'text_input';
}

export function isChecklistStep(step: TriageStep): boolean {
  return step.type === 'checklist';
}

export function stepTypeLabel(type: TriageStepType): string {
  const labels: Record<TriageStepType, string> = {
    statement: 'Statement',
    yes_no: 'Yes / No',
    multiple_choice: 'Multiple Choice',
    photo_required: 'Photo Required',
    number_input: 'Number Input',
    text_input: 'Text Input',
    checklist: 'Checklist',
  };
  return labels[type];
}
