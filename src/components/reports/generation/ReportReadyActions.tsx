import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

export default function ReportReadyActions({ downloadUrl }: { downloadUrl: string | null }) {
  const { t } = useTranslation();
  if (!downloadUrl) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <a href={downloadUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#10B981] px-4 text-sm font-semibold text-white">
        <Download className="h-4 w-4" />
        {t('common.reports.generation.readyActions.downloadPdf')}
      </a>
    </div>
  );
}
