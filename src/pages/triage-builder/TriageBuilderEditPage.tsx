import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTriageFlow } from '../../hooks/triage/useTriageFlow';
import TriageFlowEditor from '../../components/triage/builder/TriageFlowEditor';

export default function TriageBuilderEditPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const { t } = useTranslation();
  const { flow, loading, error } = useTriageFlow(flowId);

  if (loading) return <div className="p-8 text-gray-500">{t('triage.loading')}</div>;
  if (error || !flow) return <div className="p-8 text-red-500">{error ?? 'Not found'}</div>;

  return <TriageFlowEditor initial={flow} flowId={flowId} />;
}
