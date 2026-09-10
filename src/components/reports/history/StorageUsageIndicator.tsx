import { Trans, useTranslation } from 'react-i18next';
import type { ReportHistory } from '../../../types/reports.types';

export default function StorageUsageIndicator({ reports }: { reports: ReportHistory[] }) {
  const { t } = useTranslation();
  const bytes = reports.reduce((sum, report) => sum + (report.fileSizeBytes ?? 0), 0);
  const mb = bytes / 1024 / 1024;
  return (
    <div className="rounded-lg border border-[#1E3A5F] bg-[#0F1E35] p-4 text-sm text-[#8BA3BF]">
      <Trans
        t={t}
        i18nKey="common.reports.history.storageUsageIndicator.summary"
        count={reports.length}
        values={{ count: reports.length, mb: mb.toFixed(1) }}
        components={{ strong: <span className="font-semibold text-[#F0F4F8]" /> }}
      />
    </div>
  );
}
