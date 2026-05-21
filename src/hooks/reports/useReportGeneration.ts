import { useReportsStore } from '../../store/reports.store';

export function useReportGeneration() {
  const generationStatus = useReportsStore((state) => state.generationStatus);
  const generationProgress = useReportsStore((state) => state.generationProgress);
  const generationError = useReportsStore((state) => state.generationError);
  const lastDownloadUrl = useReportsStore((state) => state.lastDownloadUrl);
  const lastSheetsUrl = useReportsStore((state) => state.lastSheetsUrl);
  const generatePdf = useReportsStore((state) => state.generatePdf);
  const exportExcel = useReportsStore((state) => state.exportExcel);
  const pushToSheets = useReportsStore((state) => state.pushToSheets);

  return {
    generationStatus,
    generationProgress,
    generationError,
    lastDownloadUrl,
    lastSheetsUrl,
    generatePdf,
    exportExcel,
    pushToSheets,
    isGenerating: ['fetching_data', 'building', 'finalizing'].includes(generationStatus),
  };
}
