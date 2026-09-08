import { useTranslation } from 'react-i18next';
import type { TriageSessionStatus } from '../../../types/triage';

interface Props {
  status: TriageSessionStatus;
}

const statusClassNames: Record<TriageSessionStatus, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  escalated: 'bg-red-100 text-red-700',
  quick_fix: 'bg-teal-100 text-teal-700',
  abandoned: 'bg-gray-100 text-gray-600',
};

export default function TriageSessionStatusBadge({ status }: Props) {
  const { t } = useTranslation();
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${statusClassNames[status]}`}>
      {t(`triage.session_status.${status}`)}
    </span>
  );
}
