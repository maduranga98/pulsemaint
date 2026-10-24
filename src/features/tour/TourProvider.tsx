import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS, type CallBackProps, type Step } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { TOUR_DEFS, type TourStepDef } from './tourDefs';
import { visibleSteps } from './tourTargets';
import { readTourOutcome, writeTourOutcome, type TourId } from './tourState';
import TourTooltip from './TourTooltip';

interface TourApi {
  /** Start a tour now (from a Help button); shows it even if it was taken before. */
  start: (tour: TourId) => boolean;
  /** Start a tour only if this user has never completed or dismissed it. */
  startOnce: (tour: TourId, minSteps?: number) => boolean;
  running: boolean;
}

/** Tours already opened automatically in this page session — keeps a browser that blocks localStorage from showing one again and again. */
const autoStarted = new Set<string>();

const TourContext = createContext<TourApi>({ start: () => false, startOnce: () => false, running: false });
export const useTour = () => useContext(TourContext);

/**
 * Runs the guided tours. A tour points a floating card at elements marked `data-tour="…"`,
 * moves on with Next / Previous, and remembers (per user, in localStorage) once it is completed or
 * dismissed so it does not open on its own again. Built on react-joyride.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.userProfile?.id);
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const current = useRef<TourId | null>(null);
  const { pathname } = useLocation();
  /** Page the tour was started on — leaving it ends the tour (its targets no longer exist). */
  const startPath = useRef<string | null>(null);

  const text = useCallback((literal: string | undefined, key: string | undefined) => literal ?? (key ? (t(key as never) as unknown as string) : ''), [t]);

  const toSteps = useCallback((defs: TourStepDef[]): Step[] => defs.map((d) => ({
    target: d.target,
    placement: d.placement ?? 'auto',
    title: text(d.title, d.titleKey),
    content: text(d.body, d.bodyKey),
    disableBeacon: true,
    ...(d.target === 'body' ? { placement: 'center' as const } : {}),
  })), [text]);

  const begin = useCallback((tour: TourId, minSteps: number): boolean => {
    const defs = visibleSteps(TOUR_DEFS[tour]);
    if (defs.length < minSteps) return false;
    current.current = tour;
    startPath.current = window.location.pathname;
    setSteps(toSteps(defs));
    setStepIndex(0);
    setRun(true);
    return true;
  }, [toSteps]);

  const start = useCallback((tour: TourId) => {
    const ok = begin(tour, 1);
    if (!ok) toast.info(t('tour.ui.nothingToShow'));
    return ok;
  }, [begin, t]);

  const startOnce = useCallback((tour: TourId, minSteps = 3) => {
    if (!userId || run || autoStarted.has(`${userId}:${tour}`) || readTourOutcome(userId, tour)) return false;
    const started = begin(tour, minSteps);
    if (started) autoStarted.add(`${userId}:${tour}`);
    return started;
  }, [begin, run, userId]);

  const finish = useCallback((outcome: 'completed' | 'dismissed') => {
    if (userId && current.current) writeTourOutcome(userId, current.current, outcome);
    current.current = null;
    setRun(false);
    setStepIndex(0);
  }, [userId]);

  const onCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data;
    if (status === STATUS.FINISHED) return finish('completed');
    if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE || action === ACTIONS.SKIP) return finish('dismissed');
    if (type === EVENTS.STEP_AFTER) setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    // The element vanished (route changed, panel closed): move on rather than get stuck.
    else if (type === EVENTS.TARGET_NOT_FOUND) setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
  }, [finish]);

  // A route change or sign-out while a tour is open ends it quietly (without marking it as seen).
  // Without this the overlay stayed on top of the next page with no card to dismiss it, which
  // froze the whole app on phones.
  useEffect(() => {
    if (!run) return;
    if (!userId || (startPath.current !== null && pathname !== startPath.current)) {
      setRun(false);
      setStepIndex(0);
      current.current = null;
      startPath.current = null;
    }
  }, [userId, run, pathname]);

  const api = useMemo<TourApi>(() => ({ start, startOnce, running: run }), [start, startOnce, run]);

  return (
    <TourContext.Provider value={api}>
      {children}
      {run && (
        // Always-reachable exit, above the overlay: if a card ever fails to appear the user is never trapped.
        <button
          type="button"
          onClick={() => finish('dismissed')}
          className="fixed left-1/2 z-[10001] -translate-x-1/2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-slate-800 shadow-lg"
          style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {t('tour.ui.skip')}
        </button>
      )}
      <Joyride
        run={run}
        steps={steps}
        stepIndex={stepIndex}
        continuous
        scrollToFirstStep
        scrollOffset={96}
        spotlightPadding={6}
        disableOverlayClose
        disableScrollParentFix={false}
        callback={onCallback}
        tooltipComponent={TourTooltip}
        floaterProps={{ disableAnimation: false, styles: { floater: { filter: 'none' } } }}
        styles={{
          options: { zIndex: 10000, overlayColor: 'rgba(8, 15, 30, 0.62)', arrowColor: '#ffffff' },
          spotlight: { borderRadius: 10 },
        }}
      />
    </TourContext.Provider>
  );
}
