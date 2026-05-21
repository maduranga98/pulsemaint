import { create } from 'zustand';
import type {
  ChartDateRange,
  DashboardVariant,
  AnalyticsDaily,
  AnalyticsMonthly,
  MachineHealthDoc,
  TechnicianStatusDoc,
  SidePanelState,
} from '../types/analytics.types';
import {
  fetchDailyAnalytics,
  fetchMonthlyAnalytics,
  fetchMachineHealth,
  getDateRange,
} from '../services/analytics.service';

interface DashboardStore {
  // Active role / dashboard variant
  activeDashboard: DashboardVariant;
  setActiveDashboard: (variant: DashboardVariant) => void;

  // Live counts (from real-time listeners)
  activeBreakdownCount: number;
  openWoCount: number;
  pendingPartsRequests: number;
  lowStockCount: number;
  setActiveBreakdownCount: (count: number) => void;
  setOpenWoCount: (count: number) => void;
  setPendingPartsRequests: (count: number) => void;
  setLowStockCount: (count: number) => void;

  // Date range for charts
  chartDateRange: ChartDateRange;
  setChartDateRange: (range: ChartDateRange) => void;

  // Analytics data (from pre-aggregated collections)
  dailyAnalytics: AnalyticsDaily[];
  monthlyAnalytics: AnalyticsMonthly | null;
  machineHealth: MachineHealthDoc[];
  technicianStatuses: TechnicianStatusDoc[];
  analyticsLoading: boolean;
  analyticsError: string | null;

  // UI state
  selectedMachineId: string | null;
  selectedTechnicianId: string | null;
  sidePanel: SidePanelState;
  setSidePanel: (panel: SidePanelState) => void;
  closeSidePanel: () => void;

  // Fetch actions
  fetchDailyAnalytics: (companyId: string, range: ChartDateRange) => Promise<void>;
  fetchMonthlyAnalytics: (companyId: string, month: string) => Promise<void>;
  fetchMachineHealth: (companyId: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  activeDashboard: 'supervisor',
  setActiveDashboard: (variant) => set({ activeDashboard: variant }),

  activeBreakdownCount: 0,
  openWoCount: 0,
  pendingPartsRequests: 0,
  lowStockCount: 0,
  setActiveBreakdownCount: (count) => set({ activeBreakdownCount: count }),
  setOpenWoCount: (count) => set({ openWoCount: count }),
  setPendingPartsRequests: (count) => set({ pendingPartsRequests: count }),
  setLowStockCount: (count) => set({ lowStockCount: count }),

  chartDateRange: '30D',
  setChartDateRange: (range) => {
    set({ chartDateRange: range });
    // Trigger re-fetch if companyId is available
  },

  dailyAnalytics: [],
  monthlyAnalytics: null,
  machineHealth: [],
  technicianStatuses: [],
  analyticsLoading: false,
  analyticsError: null,

  selectedMachineId: null,
  selectedTechnicianId: null,
  sidePanel: { type: null, id: null },
  setSidePanel: (panel) => set({ sidePanel: panel }),
  closeSidePanel: () => set({ sidePanel: { type: null, id: null } }),

  fetchDailyAnalytics: async (companyId, range) => {
    set({ analyticsLoading: true, analyticsError: null });
    try {
      const { from, to } = getDateRange(range);
      const data = await fetchDailyAnalytics(companyId, from, to);
      set({ dailyAnalytics: data, analyticsLoading: false });
    } catch (err) {
      set({ analyticsError: (err as Error).message, analyticsLoading: false });
    }
  },

  fetchMonthlyAnalytics: async (companyId, month) => {
    set({ analyticsLoading: true, analyticsError: null });
    try {
      const data = await fetchMonthlyAnalytics(companyId, month);
      set({ monthlyAnalytics: data, analyticsLoading: false });
    } catch (err) {
      set({ analyticsError: (err as Error).message, analyticsLoading: false });
    }
  },

  fetchMachineHealth: async (companyId) => {
    try {
      const data = await fetchMachineHealth(companyId);
      set({ machineHealth: data });
    } catch (err) {
      // Non-fatal; machine health is supplementary
      console.error('Failed to fetch machine health:', err);
    }
  },
}));
