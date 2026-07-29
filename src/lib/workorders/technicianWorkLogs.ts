import type { ChecklistItem, TechnicianWorkLog } from '../../types/workOrder';

export interface WorkOrderAssignee {
  technicianId: string;
  technicianName: string;
}

/** Checklist fields this builder reads. Kept narrow so tests don't have to
 *  construct a whole ChecklistItem. */
export type WorkLogChecklistItem = Pick<
  ChecklistItem,
  'stepDescription' | 'isCompleted' | 'completedBy'
> & {
  notes?: string | null;
  measurementValue?: number | null;
  unit?: string | null;
};

/**
 * The per-person work log recorded when a work order is completed.
 *
 * Composed entirely from what the job already recorded — the checklist steps
 * each person ticked off (with their notes and any measurement they entered)
 * plus the work-done description written on the completion form. It is never
 * typed in by hand: a free-text box per assignee let the record drift from
 * the checklist, and left it blank whenever the person completing the form
 * wasn't the person who did the work.
 *
 * Hours worked come from the work order's actual start/end times, which are
 * stamped automatically, so every field here is derived.
 */
export function buildTechnicianWorkLogs(
  assignees: WorkOrderAssignee[],
  checklist: WorkLogChecklistItem[],
  workDoneDescription: string,
  hoursWorked: number,
): TechnicianWorkLog[] {
  const summary = workDoneDescription.trim();

  return assignees.map(({ technicianId, technicianName }) => {
    const completedSteps = checklist.filter(
      (item) => item.isCompleted && !!technicianId && item.completedBy === technicianId,
    );

    const lines = completedSteps.map((item) => {
      const parts = [`✓ ${item.stepDescription}`];
      if (item.measurementValue != null) {
        parts.push(`— ${item.measurementValue}${item.unit ? ` ${item.unit}` : ''}`);
      }
      if (item.notes?.trim()) parts.push(`— ${item.notes.trim()}`);
      return parts.join(' ');
    });

    if (summary) lines.push(`Work done: ${summary}`);

    return {
      technicianId,
      technicianName,
      hoursWorked,
      tasksDescription: lines.join('\n'),
    };
  });
}
