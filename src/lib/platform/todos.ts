/**
 * Lumora platform To-Dos (platformTodos, superadmin only). Reminders and
 * tasks, optionally linked to a lead (call), a company or a feature request.
 * A "testing" to-do is created when a feature request moves to Testing;
 * finishing it closes the request.
 */

export const TODO_KINDS = ['reminder', 'task', 'testing'] as const;
export type TodoKind = (typeof TODO_KINDS)[number];
export const TODO_KIND_LABEL: Record<TodoKind, string> = { reminder: 'Reminder', task: 'Task', testing: 'Testing' };

export interface Todo {
  id: string;
  kind: TodoKind;
  title: string;
  notes: string;
  /** Testing to-dos: the steps to verify the feature request. */
  howToTest: string;
  /** Due date/time in ms, or null for "someday". */
  dueAt: number | null;
  done: boolean;
  doneAt: number | null;
  leadId: string | null;
  leadName: string | null;
  companyId: string | null;
  companyName: string | null;
  featureRequestId: string | null;
  createdAt: number | null;
  createdByEmail: string | null;
}

export type TodoBucket = 'overdue' | 'today' | 'upcoming' | 'someday' | 'done';
export const TODO_BUCKET_LABEL: Record<TodoBucket, string> = {
  overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming', someday: 'No due date', done: 'Done',
};

function dayBounds(now: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.getTime(), end: end.getTime() };
}

/** Which list a to-do belongs in, relative to `now` (local day boundaries). */
export function todoBucket(t: Pick<Todo, 'done' | 'dueAt'>, now = Date.now()): TodoBucket {
  if (t.done) return 'done';
  if (t.dueAt == null) return 'someday';
  if (t.dueAt < now) return 'overdue';
  return t.dueAt < dayBounds(now).end ? 'today' : 'upcoming';
}

/** Open to-dos that are overdue or due before the end of today — the nav badge count. */
export function countTodosDue(todos: Pick<Todo, 'done' | 'dueAt'>[], now = Date.now()): number {
  const { end } = dayBounds(now);
  return todos.filter((t) => !t.done && t.dueAt != null && t.dueAt < end).length;
}

/** Groups to-dos into ordered buckets: overdue/today/upcoming by due date, someday by creation, done newest first. */
export function groupTodos<T extends Todo>(todos: T[], now = Date.now()): { bucket: TodoBucket; items: T[] }[] {
  const order: TodoBucket[] = ['overdue', 'today', 'upcoming', 'someday', 'done'];
  const map = new Map<TodoBucket, T[]>(order.map((b) => [b, []]));
  for (const t of todos) map.get(todoBucket(t, now))!.push(t);
  map.get('overdue')!.sort((a, b) => a.dueAt! - b.dueAt!);
  map.get('today')!.sort((a, b) => a.dueAt! - b.dueAt!);
  map.get('upcoming')!.sort((a, b) => a.dueAt! - b.dueAt!);
  map.get('someday')!.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  map.get('done')!.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  return order.map((bucket) => ({ bucket, items: map.get(bucket)! })).filter((g) => g.items.length > 0);
}
