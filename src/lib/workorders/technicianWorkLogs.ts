import type { ChecklistItem, TechnicianWorkLog } from '../../types/workOrder';

export interface WorkOrderAssignee {
  technicianId: string;
  technicianName: string;
  /** Role/designation, carried onto the log so a team WO shows who did what. */
  technicianRole?: string;
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
 * Each assignee's log is built only from *their own* work: the checklist steps
 * they personally ticked off (with their notes/measurements) plus the work
 * they were recorded as doing on the completion form's per-person "work done"
 * entry (`workDoneByTech`, keyed by technician id). Nothing is shared across
 * people — previously a single work-done description was appended to every
 * assignee's log, so a team work order showed the same task under everyone's
 * name.
 *
 * Hours worked come from the work order's actual start/end times, which are
 * stamped automatically.
 */
export function buildTechnicianWorkLogs(
  assignees: WorkOrderAssignee[],
  checklist: WorkLogChecklistItem[],
  workDoneByTech: Record<string, string>,
  hoursWorked: number,
): TechnicianWorkLog[] {
  return assignees.map(({ technicianId, technicianName, technicianRole }) => {
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

    // This person's own recorded work — never another assignee's.
    const own = (workDoneByTech[technicianId] ?? '').trim();
    if (own) lines.push(`Work done: ${own}`);

    return {
      technicianId,
      technicianName,
      technicianRole: technicianRole ?? '',
      hoursWorked,
      tasksDescription: lines.join('\n'),
    };
  });
}
