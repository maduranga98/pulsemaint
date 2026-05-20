import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { createTriageSession } from '../../../lib/triage/triageSessionManager';
import type { TriageFlow } from '../../../types/triage';

interface Props {
  flow: TriageFlow;
}

export default function TriageFlowDemoLauncher({ flow }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userProfile } = useAuthStore();
  const [launching, setLaunching] = useState(false);

  const handleDemo = async () => {
    if (!userProfile) return;
    setLaunching(true);
    try {
      const sessionId = await createTriageSession({
        companyId: userProfile.companyId ?? '',
        machineId: 'demo',
        machineName: 'Demo Machine',
        flow,
        supervisorId: userProfile.id ?? '',
        supervisorName: userProfile.fullName ?? 'Demo User',
        language: flow.language,
        isDemo: true,
      });
      navigate(`/app/triage/${sessionId}`);
    } catch (err) {
      console.error('Demo launch error:', err);
      setLaunching(false);
    }
  };

  return (
    <button
      onClick={handleDemo}
      disabled={launching}
      className="px-4 py-2 bg-amber-500 text-white font-medium rounded-lg text-sm hover:bg-amber-600 disabled:opacity-40"
    >
      {launching ? t('triage.loading') : t('triage.run_demo')}
    </button>
  );
}
