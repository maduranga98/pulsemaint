import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeOpenTodos } from '@/services/platformTodosService';
import { countTodosDue, type Todo } from './todos';

/** Superadmins: open to-dos overdue or due today (To-Do nav badge). Re-counts every minute. */
export function useTodosDue(enabled: boolean): number {
  const [open, setOpen] = useState<Todo[]>([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!enabled) {
      setOpen([]);
      return undefined;
    }
    return subscribeOpenTodos(setOpen);
  }, [enabled]);
  return countTodosDue(open, now);
}

/** Superadmins: leads still at "New" (never called), not archived (Leads nav badge). */
export function useNewLeads(enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return undefined;
    }
    return onSnapshot(
      query(collection(db, 'platformLeads'), where('status', '==', 'new')),
      (snap) => setCount(snap.docs.filter((d) => d.get('archived') !== true).length),
      () => setCount(0),
    );
  }, [enabled]);
  return count;
}

const SEEN_KEY = 'platform.seen.featureRequests';

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Remembers (in this browser) that the Feature requests page was opened now. */
export function markFeatureRequestsSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    window.dispatchEvent(new Event(SEEN_KEY));
  } catch {
    /* storage unavailable — the badge just stays */
  }
}

/**
 * Superadmins: feature requests / bugs still at "Requested" that were added
 * since this browser last opened the Feature requests page (nav badge).
 */
export function useUnseenFeatureRequests(enabled: boolean): number {
  const [created, setCreated] = useState<number[]>([]);
  const [seen, setSeen] = useState(readSeen);
  useEffect(() => {
    const onSeen = () => setSeen(readSeen());
    window.addEventListener(SEEN_KEY, onSeen);
    window.addEventListener('storage', onSeen);
    return () => {
      window.removeEventListener(SEEN_KEY, onSeen);
      window.removeEventListener('storage', onSeen);
    };
  }, []);
  useEffect(() => {
    if (!enabled) {
      setCreated([]);
      return undefined;
    }
    return onSnapshot(
      query(collection(db, 'platformFeatureRequests'), where('status', '==', 'requested')),
      (snap) => setCreated(snap.docs.map((d) => d.get('createdAt')?.toMillis?.() ?? Date.now())),
      () => setCreated([]),
    );
  }, [enabled]);
  return created.filter((t) => t > seen).length;
}
