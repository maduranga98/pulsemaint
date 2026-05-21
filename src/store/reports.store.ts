import { create } from 'zustand';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../lib/firebase';
import { useAuthStore } from './authStore';
import { REPORT_DEFINITIONS } from '../utils/reports/reportDefinitions';
import { resolveQuickDateRange } from '../utils/reports/dateRangeUtils';
import { exportGenericReportExcel } from '../utils/reports/excel/reports/genericReportExcel';
import {
  createReportHistory,
  deleteReportHistory as deleteReportHistoryDoc,
  fetchReportHistory as fetchReportHistoryDocs,
  filtersFromConfig,
} from '../services/reports.service';
import type {
  GenerateReportResult,
  PushToSheetsResult,
  ReportConfig,
  ReportHistory,
  ReportHistoryFilters,
  ReportType,
} from '../types/reports.types';

const monthRange = resolveQuickDateRange('this_month');

const defaultConfig: ReportConfig = {
  dateFrom: monthRange.from,
  dateTo: monthRange.to,
  quickRange: 'this_month',
  machines: [],
  departments: [],
  severities: [],
  woTypes: [],
  breakdownTypes: [],
  technicians: [],
  contractors: [],
  partCategories: [],
  shifts: [],
  supervisors: [],
  priorities: [],
  invoiceStatuses: [],
  trainingStatuses: [],
  slaStatuses: [],
  outputFormat: 'pdf',
  includeCharts: true,
  includeDataTable: true,
  paperSize: 'A4',
  orientation: 'portrait',
};

interface ReportsStore {
  selectedReportType: ReportType | null;
  isConfigPanelOpen: boolean;
  config: ReportConfig;
  generationStatus: 'idle' | 'fetching_data' | 'building' | 'finalizing' | 'ready' | 'error';
  generationProgress: number;
  lastGeneratedReportId: string | null;
  lastDownloadUrl: string | null;
  lastSheetsUrl: string | null;
  generationError: string | null;
  reportHistory: ReportHistory[];
  historyLoading: boolean;
  historyFilters: ReportHistoryFilters;
  openConfigPanel: (reportType: ReportType) => void;
  closeConfigPanel: () => void;
  updateConfig: (updates: Partial<ReportConfig>) => void;
  resetConfig: () => void;
  generatePdf: () => Promise<void>;
  exportExcel: () => Promise<void>;
  pushToSheets: () => Promise<void>;
  fetchReportHistory: () => Promise<void>;
  deleteReportHistory: (reportId: string) => Promise<void>;
  updateHistoryFilters: (updates: Partial<ReportHistoryFilters>) => void;
}

const getAuthContext = () => {
  const auth = useAuthStore.getState();
  return {
    companyId: auth.company?.id ?? auth.userProfile?.companyId ?? '',
    userId: auth.user?.uid ?? '',
    userName: auth.userProfile?.fullName ?? auth.user?.email ?? 'Unknown user',
  };
};

export const useReportsStore = create<ReportsStore>((set, get) => ({
  selectedReportType: null,
  isConfigPanelOpen: false,
  config: defaultConfig,
  generationStatus: 'idle',
  generationProgress: 0,
  lastGeneratedReportId: null,
  lastDownloadUrl: null,
  lastSheetsUrl: null,
  generationError: null,
  reportHistory: [],
  historyLoading: false,
  historyFilters: {
    reportType: 'all',
    format: 'all',
    generatedBy: '',
    dateFrom: '',
    dateTo: '',
  },

  openConfigPanel: (reportType) => set({
    selectedReportType: reportType,
    isConfigPanelOpen: true,
    generationStatus: 'idle',
    generationProgress: 0,
    generationError: null,
    lastDownloadUrl: null,
    lastSheetsUrl: null,
  }),
  closeConfigPanel: () => set({ isConfigPanelOpen: false }),
  updateConfig: (updates) => set((state) => ({ config: { ...state.config, ...updates } })),
  resetConfig: () => set({ config: defaultConfig }),
  updateHistoryFilters: (updates) => set((state) => ({ historyFilters: { ...state.historyFilters, ...updates } })),

  generatePdf: async () => {
    const { selectedReportType, config } = get();
    const { companyId, userId } = getAuthContext();
    if (!selectedReportType || !companyId) return;

    set({ generationStatus: 'fetching_data', generationProgress: 18, generationError: null });
    try {
      const callable = httpsCallable(getFunctions(app), 'generateReport');
      set({ generationStatus: 'building', generationProgress: 48 });
      const response = await callable({
        reportType: selectedReportType,
        dateFrom: config.dateFrom,
        dateTo: config.dateTo,
        filters: filtersFromConfig(config),
        companyId,
        userId,
        options: {
          includeCharts: config.includeCharts,
          includeDataTable: config.includeDataTable,
          paperSize: config.paperSize,
          orientation: config.orientation,
        },
      });
      set({ generationStatus: 'finalizing', generationProgress: 84 });
      const result = response.data as GenerateReportResult;
      set({
        generationStatus: 'ready',
        generationProgress: 100,
        lastGeneratedReportId: result.reportId,
        lastDownloadUrl: result.downloadUrl,
      });
    } catch (err) {
      set({
        generationStatus: 'error',
        generationProgress: 0,
        generationError: err instanceof Error ? err.message : 'Report generation failed.',
      });
    }
  },

  exportExcel: async () => {
    const { selectedReportType, config } = get();
    const { companyId, userId, userName } = getAuthContext();
    if (!selectedReportType || !companyId) return;
    if (!REPORT_DEFINITIONS[selectedReportType].supportsExcel) {
      set({ generationStatus: 'error', generationError: 'This report is PDF-only.' });
      return;
    }

    set({ generationStatus: 'fetching_data', generationProgress: 30, generationError: null });
    try {
      const rowCount = await exportGenericReportExcel(selectedReportType, companyId, config);
      const reportId = await createReportHistory({
        companyId,
        reportType: selectedReportType,
        generatedBy: userId,
        generatedByName: userName,
        format: 'excel',
        config,
        rowCount,
      });
      set({
        generationStatus: 'ready',
        generationProgress: 100,
        lastGeneratedReportId: reportId,
      });
    } catch (err) {
      set({
        generationStatus: 'error',
        generationError: err instanceof Error ? err.message : 'Excel export failed.',
      });
    }
  },

  pushToSheets: async () => {
    const { selectedReportType, config } = get();
    const { companyId } = getAuthContext();
    if (!selectedReportType || !companyId) return;
    set({ generationStatus: 'building', generationProgress: 45, generationError: null });
    try {
      const callable = httpsCallable(getFunctions(app), 'pushToGoogleSheets');
      const response = await callable({
        reportType: selectedReportType,
        dateFrom: config.dateFrom,
        dateTo: config.dateTo,
        filters: filtersFromConfig(config),
        companyId,
        googleAccessToken: localStorage.getItem('pulsemaint_google_sheets_token') ?? '',
      });
      const result = response.data as PushToSheetsResult;
      set({
        generationStatus: 'ready',
        generationProgress: 100,
        lastSheetsUrl: result.sheetsUrl,
      });
    } catch (err) {
      set({
        generationStatus: 'error',
        generationError: err instanceof Error ? err.message : 'Google Sheets export failed.',
      });
    }
  },

  fetchReportHistory: async () => {
    const { companyId } = getAuthContext();
    if (!companyId) return;
    set({ historyLoading: true });
    try {
      const reportHistory = await fetchReportHistoryDocs(companyId, get().historyFilters);
      set({ reportHistory, historyLoading: false });
    } catch {
      set({ historyLoading: false });
    }
  },

  deleteReportHistory: async (reportId) => {
    await deleteReportHistoryDoc(reportId);
    set((state) => ({
      reportHistory: state.reportHistory.filter((item) => item.id !== reportId),
    }));
  },
}));
