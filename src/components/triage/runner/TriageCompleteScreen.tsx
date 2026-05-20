import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TriageSession, TriageOutcomeType } from '../../../types/triage';
import { completeSession } from '../../../lib/triage/triageSessionManager';
import TriageOutcomeCard from '../shared/TriageOutcomeCard';
import TriagePhotoGallery from './TriagePhotoGallery';

interface Props {
  session: TriageSession;
}

const OUTCOMES: TriageOutcomeType[] = [
  'resolved_by_operator',
  'repair_team_required',
  'machine_shutdown',
  'emergency_escalated',
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function TriageCompleteScreen({ session }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<TriageOutcomeType>(
    session.outcomeType ?? 'resolved_by_operator'
  );
  const [notes, setNotes] = useState(session.outcomeNotes ?? '');
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    try {
      await completeSession(session.id, outcome, notes, session.startedAt);
      navigate('/app/triage/history');
    } catch (err) {
      console.error('completeSession error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-[#0A1628] px-4 py-6 flex items-center gap-3">
        <div className="w-12 h-12 bg-[#10B981] rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold font-['Sora']">{t('triage.complete')}</h1>
          <p className="text-white/70 text-sm">{session.machineName}</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">{t('triage.duration_label')}</p>
            <p className="font-bold text-gray-800">{formatDuration(session.totalDuration)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">{t('triage.flow_label')}</p>
            <p className="font-bold text-gray-800 text-sm truncate">{session.flowName}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">{t('triage.outcome_label')}</p>
          <div className="flex flex-col gap-2">
            {OUTCOMES.map((o) => (
              <label key={o} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 border-gray-200 hover:bg-gray-50">
                <input
                  type="radio"
                  name="outcome"
                  value={o}
                  checked={outcome === o}
                  onChange={() => setOutcome(o)}
                  className="w-5 h-5 accent-[#1A56DB]"
                />
                <span className="text-[16px] text-gray-700">{t(`triage.outcome.${o}`)}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">{t('triage.notes_label')}</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border-2 border-gray-300 rounded-xl px-3 py-2 text-[16px] focus:outline-none focus:ring-2 focus:ring-[#1A56DB] resize-none"
          />
        </div>

        <TriageOutcomeCard outcome={outcome} />

        {session.photosCaptured.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">{t('triage.session_photos')}</p>
            <TriagePhotoGallery photoUrls={session.photosCaptured} />
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={handleFinish}
            disabled={saving}
            className="w-full min-h-[56px] bg-[#1A56DB] text-white font-bold text-[18px] rounded-xl disabled:opacity-40 hover:bg-blue-700"
          >
            {saving ? t('triage.loading') : t('triage.submit')}
          </button>
          <button
            onClick={() => navigate('/app/triage/history')}
            className="w-full min-h-[48px] border-2 border-gray-300 text-gray-700 font-medium text-[16px] rounded-xl hover:bg-gray-50"
          >
            {t('triage.back_to_history')}
          </button>
        </div>
      </div>
    </div>
  );
}
