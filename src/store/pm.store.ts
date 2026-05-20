import { create } from 'zustand';
import type {
  PMSchedule,
  PMHistory,
  PMFilters,
  ComplianceStats,
  CalendarEvent,
  TechnicianWorkload,
} from '../types/pm.types';

interface PMStoreState {
  schedules: PMSchedule[];
  pmHistory: PMHistory[];
  calendarEvents: CalendarEvent[];
  calendarView: 'week' | 'month';
  workloadViewRange: 7 | 14 | 30;
  selectedScheduleId: string | null;
  filters: PMFilters;
  complianceStats: ComplianceStats | null;
  technicianWorkloads: TechnicianWorkload[];
  loading: boolean;
  error: string | null;
}

interface PMStoreActions {
  setSchedules: (schedules: PMSchedule[]) => void;
  addSchedule: (schedule: PMSchedule) => void;
  updateSchedule: (schedule: PMSchedule) => void;
  removeSchedule: (id: string) => void;
  setPMHistory: (history: PMHistory[]) => void;
  addPMHistory: (entry: PMHistory) => void;
  setCalendarEvents: (events: CalendarEvent[]) => void;
  setCalendarView: (view: 'week' | 'month') => void;
  setWorkloadViewRange: (range: 7 | 14 | 30) => void;
  setSelectedScheduleId: (id: string | null) => void;
  setFilters: (filters: Partial<PMFilters>) => void;
  resetFilters: () => void;
  setComplianceStats: (stats: ComplianceStats | null) => void;
  setTechnicianWorkloads: (workloads: TechnicianWorkload[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const defaultFilters: PMFilters = {
  machineId: undefined,
  pmType: undefined,
  technicianId: undefined,
  status: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  priority: undefined,
  searchQuery: '',
};

export const usePMStore = create<PMStoreState & PMStoreActions>((set) => ({
  schedules: [],
  pmHistory: [],
  calendarEvents: [],
  calendarView: 'month',
  workloadViewRange: 30,
  selectedScheduleId: null,
  filters: { ...defaultFilters },
  complianceStats: null,
  technicianWorkloads: [],
  loading: false,
  error: null,

  setSchedules: (schedules) => set({ schedules }),
  addSchedule: (schedule) => set((state) => ({ schedules: [schedule, ...state.schedules] })),
  updateSchedule: (schedule) =>
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === schedule.id ? schedule : s)),
    })),
  removeSchedule: (id) =>
    set((state) => ({
      schedules: state.schedules.filter((s) => s.id !== id),
    })),

  setPMHistory: (pmHistory) => set({ pmHistory }),
  addPMHistory: (entry) => set((state) => ({ pmHistory: [entry, ...state.pmHistory] })),

  setCalendarEvents: (calendarEvents) => set({ calendarEvents }),
  setCalendarView: (calendarView) => set({ calendarView }),
  setWorkloadViewRange: (workloadViewRange) => set({ workloadViewRange }),

  setSelectedScheduleId: (selectedScheduleId) => set({ selectedScheduleId }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  setComplianceStats: (complianceStats) => set({ complianceStats }),
  setTechnicianWorkloads: (technicianWorkloads) => set({ technicianWorkloads }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
