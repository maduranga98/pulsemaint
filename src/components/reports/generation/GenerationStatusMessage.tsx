import { useTranslation } from 'react-i18next';
import type { useReportGeneration } from '../../../hooks/reports/useReportGeneration';

type Status = ReturnType<typeof useReportGeneration>['generationStatus'];

export default function GenerationStatusMessage({ status }: { status: Status }) {
  const { t } = useTranslation();
  return <p className="text-sm text-[#8BA3BF]">{t(`common.reports.generation.statusMessage.${status}`)}</p>;
}
