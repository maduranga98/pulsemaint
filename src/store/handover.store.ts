import { create } from 'zustand';
import { useAuthStore } from '@/store/authStore';
import type {
  DraftHandover,
  HandoverHistoryFilters,
  HandoverStore,
  ShiftStatsAuto,
} from '@/types/handover.types';
import {
  acceptHandoverCallable,
  autoCompileShiftSummary,
  fetchHandoverHistory,
  fetchPendingHandover,
  fetchShiftConfigs,
  resolveWatchFlag as resolveWatchFlagService,
  submitHandoverCallable,
} from '@/services/handover.service';
import { detectCurrentShift } from '@/utils/handover.utils';

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
  pendingHandover: null,
  hasPendingHandover: false,
  draftHandover: null,
  compiledStats: null,
  isCompilingStats: false,
  handoverHistory: [],
  historyFilters: emptyFilters,

  startShift: async (shiftConfigId: string) => {
    const profile = requireProfile();
    const shifts = await fetchShiftConfigs(profile.companyId);
    const shift = shifts.find((item) => item.id === shiftConfigId) ?? detectCurrentShift(shifts);
    set({ currentShift: shift ?? null, shiftStartTime: new Date(), isShiftActive: Boolean(shift) });
  },

  endShift: async () => {
    const stats = await get().compileShiftSummary();
    const currentShift = get().currentShift;
    const shiftStartTime = get().shiftStartTime ?? new Date();
    set({
      draftHandover: {
        shiftConfigId: currentShift?.id ?? '',
        shiftName: currentShift?.shiftName ?? 'Current Shift',
        shiftActualStart: shiftStartTime,
        watchFlags: [],
        pendingWOs: [],
        ongoingBreakdowns: [],
        partsNotes: '',
        lowStockAlerts: [],
        safetyIncidentOccurred: false,
        safetyIncidentDescription: '',
        restrictedAreas: '',
        temporaryRepairs: '',
        generalNotes: '',
        outgoingAcknowledged: false,
      },
      compiledStats: stats,
    });
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
    });
    set({ isShiftActive: false });
    return handoverId;
  },

  acceptHandover: async (handoverId: string) => {
    const profile = requireProfile();
    await acceptHandoverCallable(handoverId, profile.companyId);
    set({ pendingHandover: null, hasPendingHandover: false, isShiftActive: true, shiftStartTime: new Date() });
  },

  fetchPendingHandover: async () => {
    const profile = requireProfile();
    const pending = await fetchPendingHandover(profile.companyId);
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
