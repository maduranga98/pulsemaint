import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { REPORT_DEFINITIONS } from '../utils/reports/reportDefinitions';
import { resolveQuickDateRange } from '../utils/reports/dateRangeUtils';
import { exportGenericReportExcel } from '../utils/reports/excel/reports/genericReportExcel';
import { exportGenericReportPdf } from '../utils/reports/pdf/genericReportPdf';
import { exportGenericReportCsv } from '../utils/reports/csv/genericReportCsv';
import { exportGenericReportSheets } from '../utils/reports/sheets/genericReportSheets';
import {
  createReportHistory,
  deleteReportHistory as deleteReportHistoryDoc,
  fetchReportHistory as fetchReportHistoryDocs,
} from '../services/reports.service';
import type {
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
    if (!selectedReportType || !companyId) {
      set({
        generationStatus: 'error',
        generationError: !companyId
          ? 'Missing company context. Please log in again.'
          : 'Please select a report type before generating.',
      });
      return;
    }
    if (!config.dateFrom || !config.dateTo) {
      set({
        generationStatus: 'error',
        generationError: 'Please choose a Date From and Date To before generating.',
      });
      return;
    }

    set({ generationStatus: 'fetching_data', generationProgress: 25, generationError: null });
    try {
      const { userName } = getAuthContext();
      set({ generationStatus: 'building', generationProgress: 60 });
      // Generate the PDF entirely on the client and trigger the download.
      const rowCount = await exportGenericReportPdf(selectedReportType, companyId, config);
      set({ generationStatus: 'finalizing', generationProgress: 85 });
      const reportId = await createReportHistory({
        companyId,
        reportType: selectedReportType,
        generatedBy: userId,
        generatedByName: userName,
        format: 'pdf',
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
    if (!selectedReportType || !companyId) {
      set({
        generationStatus: 'error',
        generationError: !companyId
          ? 'Missing company context. Please log in again.'
          : 'Please select a report type before exporting.',
      });
      return;
    }
    if (!config.dateFrom || !config.dateTo) {
      set({
        generationStatus: 'error',
        generationError: 'Please choose a Date From and Date To before exporting.',
      });
      return;
    }
    const googleAccessToken = localStorage.getItem('pulsemaint_google_sheets_token') ?? '';
    if (!googleAccessToken) {
      // Sheets isn't connected — fall back to a CSV download that imports
      // directly into Google Sheets, so the action still produces a file.
      set({ generationStatus: 'building', generationProgress: 45, generationError: null });
      try {
        const { userId, userName } = getAuthContext();
        const rowCount = await exportGenericReportCsv(selectedReportType, companyId, config);
        const reportId = await createReportHistory({
          companyId,
          reportType: selectedReportType,
          generatedBy: userId,
          generatedByName: userName,
          format: 'csv',
          config,
          rowCount,
        });
        set({ generationStatus: 'ready', generationProgress: 100, lastGeneratedReportId: reportId });
      } catch (err) {
        set({
          generationStatus: 'error',
          generationError: err instanceof Error ? err.message : 'CSV export failed.',
        });
      }
      return;
    }
    set({ generationStatus: 'building', generationProgress: 45, generationError: null });
    try {
      const { userId, userName } = getAuthContext();
      // Push directly to Google Sheets from the browser using the OAuth token.
      const { rowCount, sheetsUrl } = await exportGenericReportSheets(
        selectedReportType,
        companyId,
        config,
        googleAccessToken,
      );
      const reportId = await createReportHistory({
        companyId,
        reportType: selectedReportType,
        generatedBy: userId,
        generatedByName: userName,
        format: 'google_sheets',
        config,
        rowCount,
        googleSheetsUrl: sheetsUrl,
      });
      set({
        generationStatus: 'ready',
        generationProgress: 100,
        lastGeneratedReportId: reportId,
        lastSheetsUrl: sheetsUrl,
      });
    } catch (err) {
      // If the token is stale/invalid, prompt a reconnect.
      const msg = err instanceof Error ? err.message : 'Google Sheets export failed.';
      if (/401|403|invalid|unauthor/i.test(msg)) {
        localStorage.removeItem('pulsemaint_google_sheets_token');
      }
      set({
        generationStatus: 'error',
        generationError: /401|403|invalid|unauthor/i.test(msg)
          ? 'Google session expired. Please reconnect Google Sheets and try again.'
          : msg,
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
