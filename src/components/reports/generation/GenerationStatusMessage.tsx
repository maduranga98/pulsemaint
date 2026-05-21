import type { useReportGeneration } from '../../../hooks/reports/useReportGeneration';

type Status = ReturnType<typeof useReportGeneration>['generationStatus'];

const messages: Record<Status, string> = {
  idle: 'Configure the report and choose an export action.',
  fetching_data: 'Fetching data...',
  building: 'Building report...',
  finalizing: 'Finalizing PDF...',
  ready: 'Ready to download',
  error: 'Report generation failed',
};

export default function GenerationStatusMessage({ status }: { status: Status }) {
  return <p className="text-sm text-[#8BA3BF]">{messages[status]}</p>;
}
