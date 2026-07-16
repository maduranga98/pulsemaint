import { create } from 'zustand';
import { useAuthStore } from '@/store/authStore';
import type {
  DraftHandover,
  HandoverHistoryFilters,
  HandoverStore,
  ShiftSession,
  ShiftStatsAuto,
} from '@/types/handover.types';
import {
  acceptHandoverCallable,
  attachHandoverToSession,
  autoCompileShiftSummary,
  completeShiftSession,
  fetchActiveShiftSession,
  fetchHandoverHistory,
  fetchPendingHandover,
  fetchShiftConfigs,
  resolveWatchFlag as resolveWatchFlagService,
  startShiftSession,
  submitHandoverCallable,
} from '@/services/handover.service';
import { detectCurrentShift, getMyShiftPlans } from '@/utils/handover.utils';

const emptyFilters: HandoverHistoryFilters = {
  dateFrom: null,
  dateTo: null,
  supervisorName: '',
  shiftName: '',
  department: '',
};

function requireProfile() {
  const profile = useAuthStore.getState().userProfile;
  if (!profile) throw new Error('User profile is required');
  return profile;
}

export const useHandoverStore = create<HandoverStore>((set, get) => ({
  currentShift: null,
  shiftStartTime: null,
  isShiftActive: false,
  activeSession: null,
  lastCompletedSession: null,
  isShiftStateLoaded: false,
  pendingHandover: null,
  hasPendingHandover: false,
  draftHandover: null,
  compiledStats: null,
  isCompilingStats: false,
  handoverHistory: [],
  historyFilters: emptyFilters,

  initShiftState: async () => {
    const profile = useAuthStore.getState().userProfile;
    if (!profile) return;
    try {
      const session = await fetchActiveShiftSession(profile.companyId, profile.id);
      if (session) {
        const shifts = await fetchShiftConfigs(profile.companyId);
        const shift = shifts.find((item) => item.id === session.shiftConfigId) ?? null;
        set({
          activeSession: session,
          currentShift: shift,
          shiftStartTime: session.actualStart,
          isShiftActive: true,
          isShiftStateLoaded: true,
        });
        return;
      }
    } catch (err) {
      console.error('Failed to restore active shift session', err);
    }
    set({ isShiftStateLoaded: true });
  },

  startShift: async (shiftConfigId?: string) => {
    const profile = requireProfile();
    if (get().isShiftActive) return;
    const shifts = await fetchShiftConfigs(profile.companyId);
    // Prefer an explicit choice, then the user's assigned plans (member list,
    // Settings → Users shiftId, or role scheduling), then whatever shift is
    // scheduled right now.
    const myPlans = getMyShiftPlans(shifts, { id: profile.id, role: profile.role, shiftId: profile.shiftId });
    const shift = (shiftConfigId ? shifts.find((item) => item.id === shiftConfigId) : undefined)
      ?? detectCurrentShift(myPlans)
      ?? myPlans[0]
      ?? detectCurrentShift(shifts);
    if (!shift) {
      throw new Error('No shift is assigned to you. Ask an admin to assign you to a shift plan in Settings → Shifts or Settings → Users.');
    }
    const session = await startShiftSession({
      companyId: profile.companyId,
      userId: profile.id,
      userName: profile.fullName,
      userRole: profile.role,
      shift,
    });
    set({
      currentShift: shift,
      shiftStartTime: session.actualStart,
      isShiftActive: true,
      activeSession: session,
      lastCompletedSession: null,
    });
  },

  endShift: async (): Promise<ShiftSession | null> => {
    const profile = requireProfile();
    let completed: ShiftSession | null = null;
    const session = get().activeSession;
    if (session) {
      completed = await completeShiftSession(session);
      set({ activeSession: null, lastCompletedSession: completed });
    }
    // Only supervisors/admins compile a handover report; other members just
    // close their session and see their totals.
    if (profile.role === 'supervisor' || profile.role === 'admin') {
      await get().compileShiftSummary();
    } else {
      set({ isShiftActive: false, shiftStartTime: null, currentShift: null });
    }
    return completed;
  },

  compileShiftSummary: async (): Promise<ShiftStatsAuto> => {
    const profile = requireProfile();
    const shiftStartTime = get().shiftStartTime ?? new Date(Date.now() - 8 * 60 * 60 * 1000);
    set({ isCompilingStats: true });
    try {
      const summary = await autoCompileShiftSummary({
        companyId: profile.companyId,
        supervisorId: profile.id,
        shiftStartTime,
      });
      const currentShift = get().currentShift;
      set({
        compiledStats: summary.stats,
        draftHandover: {
          shiftConfigId: currentShift?.id ?? '',
          shiftName: currentShift?.shiftName ?? 'Current Shift',
          shiftActualStart: summary.shiftStartTime,
          watchFlags: get().draftHandover?.watchFlags ?? [],
          pendingWOs: summary.pendingWOs,
          ongoingBreakdowns: summary.ongoingBreakdowns,
          partsNotes: get().draftHandover?.partsNotes ?? '',
          lowStockAlerts: summary.lowStockAlerts,
          safetyIncidentOccurred: get().draftHandover?.safetyIncidentOccurred ?? false,
          safetyIncidentDescription: get().draftHandover?.safetyIncidentDescription ?? '',
          restrictedAreas: get().draftHandover?.restrictedAreas ?? '',
          temporaryRepairs: get().draftHandover?.temporaryRepairs ?? '',
          generalNotes: get().draftHandover?.generalNotes ?? '',
          outgoingAcknowledged: get().draftHandover?.outgoingAcknowledged ?? false,
        },
      });
      return summary.stats;
    } finally {
      set({ isCompilingStats: false });
    }
  },

  updateDraftHandover: (updates: Partial<DraftHandover>) => {
    const draft = get().draftHandover;
    if (!draft) return;
    set({ draftHandover: { ...draft, ...updates } });
  },

  submitHandover: async (): Promise<string> => {
    const profile = requireProfile();
    const draft = get().draftHandover;
    const stats = get().compiledStats;
    if (!draft || !stats) throw new Error('Compile shift summary before submitting handover');
    const handoverId = await submitHandoverCallable({
      companyId: profile.companyId,
      draft,
      stats,
      outgoingSupervisorId: profile.id,
      outgoingSupervisorName: profile.fullName,
      outgoingSupervisorDesignation: (profile as { designation?: string }).designation ?? profile.role ?? null,
    });
    const completedSession = get().lastCompletedSession;
    if (completedSession) {
      try {
        await attachHandoverToSession(completedSession.id, handoverId);
      } catch (err) {
        console.error('Failed to link handover to shift session', err);
      }
    }
    set({ isShiftActive: false, shiftStartTime: null, currentShift: null });
    return handoverId;
  },

  acceptHandover: async (handoverId: string) => {
    const profile = requireProfile();
    const pending = get().pendingHandover;
    if (pending && pending.id === handoverId && pending.outgoingSupervisorId === profile.id) {
      throw new Error('You cannot accept your own handover. The incoming supervisor must accept it.');
    }
    await acceptHandoverCallable(handoverId, profile.companyId);
    // Carry the assigned/handed-over shift into the incoming supervisor's
    // active shift state so it drives their own end-shift + handover later.
    const shifts = await fetchShiftConfigs(profile.companyId);
    const myPlans = getMyShiftPlans(shifts, { id: profile.id, role: profile.role, shiftId: profile.shiftId });
    const shift = detectCurrentShift(myPlans) ?? myPlans[0] ?? detectCurrentShift(shifts);
    let session: ShiftSession | null = get().activeSession;
    if (!session && shift) {
      try {
        session = await startShiftSession({
          companyId: profile.companyId,
          userId: profile.id,
          userName: profile.fullName,
          userRole: profile.role,
          shift,
        });
      } catch (err) {
        console.error('Failed to persist incoming shift session', err);
      }
    }
    set({
      pendingHandover: null,
      hasPendingHandover: false,
      isShiftActive: true,
      shiftStartTime: session?.actualStart ?? new Date(),
      currentShift: shift ?? null,
      activeSession: session,
    });
  },

  fetchPendingHandover: async () => {
    const profile = requireProfile();
    const pending = await fetchPendingHandover(profile.companyId);
    // The outgoing supervisor should not be prompted to accept the handover
    // they just submitted — only the incoming person sees the briefing.
    if (pending && pending.outgoingSupervisorId === profile.id) {
      set({ pendingHandover: null, hasPendingHandover: false });
      return;
    }
    set({ pendingHandover: pending, hasPendingHandover: Boolean(pending) });
  },

  fetchHandoverHistory: async (filters: HandoverHistoryFilters) => {
    const profile = requireProfile();
    const history = await fetchHandoverHistory(profile.companyId, filters);
    set({ handoverHistory: history, historyFilters: filters });
  },

  resolveWatchFlag: async (handoverId: string, flagId: string) => {
    const profile = requireProfile();
    await resolveWatchFlagService(handoverId, flagId, profile.id);
    await get().fetchPendingHandover();
  },
}));
