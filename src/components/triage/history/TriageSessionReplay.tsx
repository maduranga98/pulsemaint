import { useTranslation } from 'react-i18next';
import type { TriageSession } from '../../../types/triage';
import TriageSessionStatusBadge from '../shared/TriageSessionStatusBadge';
import TriageOutcomeCard from '../shared/TriageOutcomeCard';
import TriageSessionTimeline from './TriageSessionTimeline';

interface Props {
  session: TriageSession;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function TriageSessionReplay({ session }: Props) {
  const { t } = useTranslation();
  const startedAt = new Date(session.startedAt.seconds * 1000);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#0A1628] font-['Sora']">{session.machineName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {startedAt.toLocaleDateString()} {startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <TriageSessionStatusBadge status={session.status} />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div>
            <p className="text-xs text-gray-500">Supervisor</p>
            <p className="font-medium text-sm">{session.supervisorName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Flow</p>
            <p className="font-medium text-sm">{session.flowName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Duration</p>
            <p className="font-medium text-sm">{formatDuration(session.totalDuration)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Steps completed</p>
            <p className="font-medium text-sm">{session.stepLogs.length}</p>
          </div>
        </div>

        {session.outcomeType && (
          <div className="mt-4">
            <TriageOutcomeCard outcome={session.outcomeType} notes={session.outcomeNotes} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#0A1628]">{t('triage.timeline')}</h2>
        <button className="text-sm text-[#1A56DB] hover:underline font-medium">
          {t('triage.download_pdf')}
        </button>
      </div>

      <TriageSessionTimeline stepLogs={session.stepLogs} />
    </div>
  );
}
