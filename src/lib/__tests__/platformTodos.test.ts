import { describe, expect, it } from 'vitest';
import { countTodosDue, groupTodos, todoBucket, type Todo } from '../platform/todos';

const now = new Date(2026, 9, 9, 12, 0).getTime();
const h = 3_600_000;
const base: Todo = {
  id: 'x', kind: 'task', title: 't', notes: '', dueAt: null, done: false, doneAt: null, leadId: null, leadName: null,
  companyId: null, companyName: null, featureRequestId: null, createdAt: 0, createdByEmail: null,
};

describe('todoBucket', () => {
  it('buckets by due date relative to now', () => {
    expect(todoBucket({ done: false, dueAt: now - h }, now)).toBe('overdue');
    expect(todoBucket({ done: false, dueAt: now + h }, now)).toBe('today');
    expect(todoBucket({ done: false, dueAt: now + 13 * h }, now)).toBe('upcoming');
    expect(todoBucket({ done: false, dueAt: null }, now)).toBe('someday');
    expect(todoBucket({ done: true, dueAt: now - h }, now)).toBe('done');
  });
});

describe('countTodosDue', () => {
  it('counts open to-dos overdue or due today', () => {
    expect(countTodosDue([
      { done: false, dueAt: now - 48 * h }, { done: false, dueAt: now + 2 * h }, { done: false, dueAt: now + 30 * h },
      { done: true, dueAt: now - h }, { done: false, dueAt: null },
    ], now)).toBe(2);
  });
});

describe('groupTodos', () => {
  it('orders buckets and items', () => {
    const groups = groupTodos([
      { ...base, id: 'b', dueAt: now + 3 * h }, { ...base, id: 'a', dueAt: now + 1 * h },
      { ...base, id: 'o', dueAt: now - h }, { ...base, id: 'd', done: true, doneAt: 5 },
    ], now);
    expect(groups.map((g) => g.bucket)).toEqual(['overdue', 'today', 'done']);
    expect(groups[1].items.map((t) => t.id)).toEqual(['a', 'b']);
  });
});
