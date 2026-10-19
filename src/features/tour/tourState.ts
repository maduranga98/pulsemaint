/** Which guided tours a user has already taken or dismissed — kept in the browser so a tour never pops up twice. */

export type TourId = 'main' | 'machine' | 'leads';
export type TourOutcome = 'completed' | 'dismissed';

/** Bump when the main tour changes so much that everyone should see it once more. */
const VERSION = 1;

export interface TourStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const tourKey = (userId: string, tour: TourId) => `firmicore.tour.v${VERSION}.${userId}.${tour}`;

function browserStorage(): TourStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // private mode / blocked storage
  }
}

export function readTourOutcome(userId: string, tour: TourId, storage: TourStorage | null = browserStorage()): TourOutcome | null {
  try {
    const v = storage?.getItem(tourKey(userId, tour));
    return v === 'completed' || v === 'dismissed' ? v : null;
  } catch {
    return null;
  }
}

export function writeTourOutcome(userId: string, tour: TourId, outcome: TourOutcome, storage: TourStorage | null = browserStorage()): void {
  try {
    storage?.setItem(tourKey(userId, tour), outcome);
  } catch { /* storage full or blocked — the tour may show again, which is harmless */ }
}

export function clearTourOutcome(userId: string, tour: TourId, storage: TourStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(tourKey(userId, tour));
  } catch { /* ignore */ }
}
