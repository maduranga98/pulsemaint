import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTriageSession } from '../../hooks/triage/useTriageSession';
import TriageSessionReplay from '../../components/triage/history/TriageSessionReplay';

export default function TriageSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const { session, loading, error } = useTriageSession(sessionId);

  if (loading) return <div className="p-8 text-gray-500">{t('triage.loading')}</div>;
  if (error || !session) return <div className="p-8 text-red-500">{error ?? 'Not found'}</div>;

  return <TriageSessionReplay session={session} />;
}
