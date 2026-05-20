import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTriageSession } from '../../hooks/triage/useTriageSession';
import TriageCompleteScreen from '../../components/triage/runner/TriageCompleteScreen';

export default function TriageCompletePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const { session, loading, error } = useTriageSession(sessionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-500">{t('triage.loading')}</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-red-500">{error ?? 'Session not found'}</p>
      </div>
    );
  }

  return <TriageCompleteScreen session={session} />;
}
