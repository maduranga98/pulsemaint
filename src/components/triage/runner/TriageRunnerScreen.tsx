import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import type { TriageSession, TriageLanguage, TriageSafetyLevel } from '../../../types/triage';
import { useTriageFlow } from '../../../hooks/triage/useTriageFlow';
import { useTriageStepLogger } from '../../../hooks/triage/useTriageStepLogger';
import {
  advanceToStep,
  abandonSession,
  escalateSession,
  markQuickFix,
} from '../../../lib/triage/triageSessionManager';
import TriageTopBar from './TriageTopBar';
import TriageSafetyBanner from './TriageSafetyBanner';
import TriageProgressBar from './TriageProgressBar';
import TriageStepDisplay from './TriageStepDisplay';
import TriageEscalationOverlay from './TriageEscalationOverlay';
import TriageQuickFixOverlay from './TriageQuickFixOverlay';

const bgByLevel: Record<TriageSafetyLevel, string> = {
  safe: 'bg-white',
  caution: 'bg-[#FEF3C7]',
  danger: 'bg-[#FEE2E2]',
};

interface Props {
  session: TriageSession;
}

export default function TriageRunnerScreen({ session }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<TriageLanguage>(session.language);
  const [showEscalation, setShowEscalation] = useState(false);
  const [showQuickFix, setShowQuickFix] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const { flow } = useTriageFlow(session.flowId);
  const { logStep } = useTriageStepLogger(session.id);

  // Track online state
  useState(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  });

  const currentStep = flow?.steps.find((s) => s.id === session.currentStepId);
  const stepIndex = flow?.steps.findIndex((s) => s.id === session.currentStepId) ?? 0;
  const totalSteps = flow?.steps.length ?? 0;

  const safetyLevel: TriageSafetyLevel = currentStep?.safetyLevel ?? 'safe';

  const handleLanguageChange = (lang: TriageLanguage) => {
    setLanguage(lang);
    void i18n.changeLanguage(lang);
  };

  const handleStepComplete = useCallback(
    async (result: {
      response: boolean | string | string[] | number | null;
      photoUrls: string[];
      nextStepId?: string | null;
    }) => {
      if (!currentStep || !flow) return;

      await logStep({
        stepId: currentStep.id,
        stepNumber: currentStep.stepNumber,
        phase: currentStep.phase,
        title: currentStep.title,
        completedAt: Timestamp.now(),
        durationSeconds: 0,
        response: result.response,
        photoUrls: result.photoUrls,
        notes: '',
        skipped: false,
        skipReason: '',
      });

      let nextId: string | null = null;
      if (result.nextStepId !== undefined) {
        nextId = result.nextStepId;
      } else if (stepIndex < flow.steps.length - 1) {
        nextId = flow.steps[stepIndex + 1].id;
      }

      if (nextId) {
        const nextStep = flow.steps.find((s) => s.id === nextId);
        if (nextStep) {
          await advanceToStep(session.id, nextStep.id, nextStep.stepNumber);
        }
      } else {
        // Last step — go to complete
        navigate(`/app/triage/${session.id}/complete`);
      }
    },
    [currentStep, flow, logStep, session.id, stepIndex, navigate]
  );

  const handleEscalate = useCallback(async () => {
    await escalateSession(session.id, 'Escalated from step');
    setShowEscalation(true);
  }, [session.id]);

  const handleMarkShutdown = useCallback(async () => {
    await escalateSession(session.id, 'Machine shutdown');
    navigate(`/app/triage/${session.id}/complete`);
  }, [session.id, navigate]);

  const handleAbandon = useCallback(async () => {
    await abandonSession(session.id, 'Abandoned by operator');
  }, [session.id]);

  const handleQuickFixSubmit = useCallback(
    async (description: string) => {
      await markQuickFix(session.id, description, session.startedAt);
      navigate(`/app/triage/${session.id}/complete`);
    },
    [session.id, session.startedAt, navigate]
  );

  if (!flow || !currentStep) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">{t('triage.loading')}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bgByLevel[safetyLevel]} flex flex-col`}>
      <TriageTopBar
        machineName={session.machineName}
        language={language}
        onLanguageChange={handleLanguageChange}
        startedAt={session.startedAt.seconds}
        safetyLevel={safetyLevel}
        onAbandon={handleAbandon}
      />

      <div className="pt-[60px] flex flex-col flex-1">
        {isOffline && (
          <div className="bg-amber-500 text-white text-sm font-medium text-center py-2 px-4">
            {t('triage.working_offline')}
          </div>
        )}

        <TriageSafetyBanner level={safetyLevel} />

        <TriageProgressBar
          current={stepIndex + 1}
          total={totalSteps}
          phase={currentStep.phase}
        />

        <div className="flex-1 overflow-y-auto">
          <TriageStepDisplay
            step={currentStep}
            language={language}
            onComplete={handleStepComplete}
            onEscalate={handleEscalate}
          />
        </div>

        {/* Bottom action area */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleEscalate}
            className="flex-1 min-h-[56px] border-2 border-red-400 text-red-600 font-semibold text-[15px] rounded-xl hover:bg-red-50"
          >
            {t('triage.emergency_escalate')}
          </button>
          {currentStep.isQuickFixStep && (
            <button
              onClick={() => setShowQuickFix(true)}
              className="flex-1 min-h-[56px] border-2 border-green-400 text-green-700 font-semibold text-[15px] rounded-xl hover:bg-green-50"
            >
              {t('triage.issue_resolved')}
            </button>
          )}
        </div>
      </div>

      {showEscalation && (
        <TriageEscalationOverlay
          contacts={flow.emergencyContacts}
          shutdownProcedure={flow.machineShutdownProcedure}
          onClose={() => setShowEscalation(false)}
          onMarkShutdown={handleMarkShutdown}
        />
      )}

      {showQuickFix && (
        <TriageQuickFixOverlay
          onSubmit={handleQuickFixSubmit}
          onClose={() => setShowQuickFix(false)}
        />
      )}
    </div>
  );
}
