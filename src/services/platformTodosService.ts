import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
  type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { TODO_KINDS, type Todo, type TodoKind } from '@/lib/platform/todos';

/**
 * Lumora platform To-Dos (platformTodos, superadmin only; see firestore.rules).
 * A testing to-do is linked to a feature request: completing it closes the
 * request, and closing the request completes its open testing to-dos.
 */

const todosCol = collection(db, 'platformTodos');
const featuresCol = collection(db, 'platformFeatureRequests');

const tsMs = (v: unknown): number | null =>
  v && typeof (v as { toMillis?: () => number }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : typeof v === 'number' ? v : null;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function toTodo(id: string, d: DocumentData): Todo {
  return {
    id,
    kind: (TODO_KINDS as readonly string[]).includes(d.kind) ? d.kind : 'task',
    title: str(d.title), notes: str(d.notes),
    dueAt: typeof d.dueAt === 'number' ? d.dueAt : null,
    done: d.done === true, doneAt: typeof d.doneAt === 'number' ? d.doneAt : null,
    leadId: d.leadId ?? null, leadName: d.leadName ?? null,
    companyId: d.companyId ?? null, companyName: d.companyName ?? null,
    featureRequestId: d.featureRequestId ?? null,
    createdAt: tsMs(d.createdAt), createdByEmail: d.createdByEmail ?? null,
  };
}

export function subscribeTodos(cb: (rows: Todo[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(todosCol, (snap) => cb(snap.docs.map((d) => toTodo(d.id, d.data()))), onError);
}

/** Open to-dos only — for the nav badge. */
export function subscribeOpenTodos(cb: (rows: Todo[]) => void): Unsubscribe {
  return onSnapshot(query(todosCol, where('done', '==', false)), (snap) => cb(snap.docs.map((d) => toTodo(d.id, d.data()))), () => {});
}

export interface TodoInput {
  kind: TodoKind;
  title: string;
  notes: string;
  dueAt: number | null;
  leadId: string | null;
  leadName: string | null;
  companyId: string | null;
  companyName: string | null;
  featureRequestId?: string | null;
}

function clean(input: TodoInput) {
  return {
    kind: input.kind,
    title: input.title.trim().slice(0, 300),
    notes: input.notes.trim().slice(0, 5000),
    dueAt: input.dueAt,
    leadId: input.leadId || null, leadName: input.leadId ? input.leadName : null,
    companyId: input.companyId || null, companyName: input.companyId ? input.companyName : null,
    featureRequestId: input.featureRequestId ?? null,
  };
}

export async function createTodo(input: TodoInput): Promise<void> {
  const u = auth.currentUser;
  await addDoc(todosCol, {
    ...clean(input), done: false, doneAt: null,
    createdBy: u?.uid ?? '', createdByEmail: u?.email ?? null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export function updateTodo(id: string, input: TodoInput): Promise<void> {
  return updateDoc(doc(todosCol, id), { ...clean(input), updatedAt: serverTimestamp() });
}

/** Ticks a to-do on/off. Finishing a testing to-do closes its feature request. */
export async function setTodoDone(todo: Todo, done: boolean): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(todosCol, todo.id), { done, doneAt: done ? Date.now() : null, updatedAt: serverTimestamp() });
  if (todo.kind === 'testing' && todo.featureRequestId) {
    batch.update(doc(featuresCol, todo.featureRequestId), { status: done ? 'closed' : 'testing', updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

export function deleteTodo(id: string): Promise<void> {
  return deleteDoc(doc(todosCol, id));
}

/** Open testing to-dos of a feature request. */
async function openTestingTodos(featureRequestId: string) {
  const snap = await getDocs(query(todosCol, where('featureRequestId', '==', featureRequestId)));
  return snap.docs.filter((d) => d.get('done') !== true);
}

/**
 * Feature request → Testing: saves how to test it and adds a testing to-do
 * (due tomorrow) unless one is already open.
 */
export async function moveFeatureRequestToTesting(
  fr: { id: string; title: string; type: 'feature' | 'bug'; leadId: string | null; leadName: string | null; companyId: string | null; companyName: string | null },
  howToTest: string,
): Promise<void> {
  await updateDoc(doc(featuresCol, fr.id), { status: 'testing', howToTest: howToTest.trim().slice(0, 2000), updatedAt: serverTimestamp() });
  if ((await openTestingTodos(fr.id)).length) return;
  const due = new Date();
  due.setDate(due.getDate() + 1);
  due.setHours(10, 0, 0, 0);
  await createTodo({
    kind: 'testing',
    title: `Test ${fr.type === 'bug' ? 'bug fix' : 'feature'}: ${fr.title}`,
    notes: howToTest,
    dueAt: due.getTime(),
    leadId: fr.leadId, leadName: fr.leadName,
    companyId: fr.companyId, companyName: fr.companyName,
    featureRequestId: fr.id,
  });
}

/** Feature request status change from its page; closing it completes its open testing to-dos. */
export async function setFeatureRequestStatus(id: string, status: 'requested' | 'in_progress' | 'testing' | 'closed'): Promise<void> {
  await updateDoc(doc(featuresCol, id), { status, updatedAt: serverTimestamp() });
  if (status !== 'closed') return;
  const open = await openTestingTodos(id);
  if (!open.length) return;
  const batch = writeBatch(db);
  open.forEach((d) => batch.update(d.ref, { done: true, doneAt: Date.now(), updatedAt: serverTimestamp() }));
  await batch.commit();
}
