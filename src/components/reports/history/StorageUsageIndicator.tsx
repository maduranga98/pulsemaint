import type { ReportHistory } from '../../../types/reports.types';

export default function StorageUsageIndicator({ reports }: { reports: ReportHistory[] }) {
  const bytes = reports.reduce((sum, report) => sum + (report.fileSizeBytes ?? 0), 0);
  const mb = bytes / 1024 / 1024;
  return (
    <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-4 text-sm text-[#8BA3BF]">
      <span className="font-semibold text-[#F0F4F8]">{reports.length}</span> reports saved ·{' '}
      <span className="font-semibold text-[#F0F4F8]">{mb.toFixed(1)} MB</span> used
    </div>
  );
}
