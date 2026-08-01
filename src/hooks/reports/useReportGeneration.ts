import { useReportsStore } from '../../store/reports.store';

export function useReportGeneration() {
  const generationStatus = useReportsStore((state) => state.generationStatus);
  const generationProgress = useReportsStore((state) => state.generationProgress);
  const generationError = useReportsStore((state) => state.generationError);
  const lastDownloadUrl = useReportsStore((state) => state.lastDownloadUrl);
  const generatePdf = useReportsStore((state) => state.generatePdf);
  const exportExcel = useReportsStore((state) => state.exportExcel);

  return {
    generationStatus,
    generationProgress,
    generationError,
    lastDownloadUrl,
    generatePdf,
    exportExcel,
    isGenerating: ['fetching_data', 'building', 'finalizing'].includes(generationStatus),
  };
}
