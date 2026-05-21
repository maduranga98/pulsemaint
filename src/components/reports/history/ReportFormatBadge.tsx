import ReportFormatChip from '../shared/ReportFormatChip';
import type { ExportFormat } from '../../../types/reports.types';

export default function ReportFormatBadge({ format }: { format: ExportFormat }) {
  return <ReportFormatChip format={format} />;
}
