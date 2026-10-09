import { useEffect, useState } from 'react';
import { subscribeCallsDue } from '@/services/platformLeadsService';
import { endOfDay } from './leads';

/** Superadmins: open leads with a next call due by the end of today (Calls nav badge). */
export function useCallsDue(enabled: boolean): number {
  const [count, setCount] = useState(0);
  const [dayEnd, setDayEnd] = useState(() => endOfDay(Date.now()));

  // Roll the window over at midnight.
  useEffect(() => {
    const t = setInterval(() => {
      const end = endOfDay(Date.now());
      setDayEnd((prev) => (prev === end ? prev : end));
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return undefined;
    }
    return subscribeCallsDue(dayEnd, setCount);
  }, [enabled, dayEnd]);

  return count;
}
