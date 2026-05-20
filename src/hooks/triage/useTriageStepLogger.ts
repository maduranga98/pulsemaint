import { useCallback } from 'react';
import { logStepCompletion } from '../../lib/triage/triageSessionManager';
import type { TriageStepLog } from '../../types/triage';

export function useTriageStepLogger(sessionId: string | undefined) {
  const logStep = useCallback(
    async (stepLog: TriageStepLog) => {
      if (!sessionId) return;
      try {
        await logStepCompletion(sessionId, stepLog);
      } catch (err) {
        console.error('useTriageStepLogger logStep error:', err);
      }
    },
    [sessionId]
  );

  return { logStep };
}
