import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useHandoverStore } from '@/store/handover.store';
import { useToast } from '@/hooks/useToast';
import Section1AutoStats from './Section1AutoStats';
import Section2WatchFlags from './Section2WatchFlags';
import Section3PendingWOs from './Section3PendingWOs';
import Section4OngoingBreakdowns from './Section4OngoingBreakdowns';
import Section5PartsNotes from './Section5PartsNotes';
import Section6SafetyIncidents from './Section6SafetyIncidents';
import Section7GeneralNotes from './Section7GeneralNotes';
import Section8SignOff from './Section8SignOff';

const STEPS = ['Stats', 'Watch', 'WOs', 'Breakdowns', 'Parts', 'Safety', 'Notes', 'Sign-Off'];

export function HandoverCreateForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const profile = useAuthStore((state) => state.userProfile);
  const draft = useHandoverStore((state) => state.draftHandover);
  const stats = useHandoverStore((state) => state.compiledStats);
  const updateDraftHandover = useHandoverStore((state) => state.updateDraftHandover);
  const submitHandover = useHandoverStore((state) => state.submitHandover);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!draft?.outgoingAcknowledged) {
      setSubmitError('Please confirm the sign-off before submitting.');
      return;
    }
    if (!stats) {
      setSubmitError('Shift summary is not compiled yet. End your shift first.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const id = await submitHandover();
      toast.success('Handover submitted successfully');
      navigate(`/app/shift/handover/${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit handover';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        End your shift first to compile the handover summary.
      </div>
    );
  }

  const sections = [
    <Section1AutoStats key="stats" stats={stats} />,
    <Section2WatchFlags key="watch" flags={draft.watchFlags} onChange={(watchFlags) => updateDraftHandover({ watchFlags })} />,
    <Section3PendingWOs key="wos" items={draft.pendingWOs} onChange={(pendingWOs) => updateDraftHandover({ pendingWOs })} />,
    <Section4OngoingBreakdowns key="breakdowns" items={draft.ongoingBreakdowns} onChange={(ongoingBreakdowns) => updateDraftHandover({ ongoingBreakdowns })} />,
    <Section5PartsNotes key="parts" lowStockAlerts={draft.lowStockAlerts} partsNotes={draft.partsNotes} onChange={(partsNotes) => updateDraftHandover({ partsNotes })} />,
    <Section6SafetyIncidents
      key="safety"
      safetyIncidentOccurred={draft.safetyIncidentOccurred}
      safetyIncidentDescription={draft.safetyIncidentDescription}
      restrictedAreas={draft.restrictedAreas}
      temporaryRepairs={draft.temporaryRepairs}
      onChange={updateDraftHandover}
    />,
    <Section7GeneralNotes key="notes" value={draft.generalNotes} onChange={(generalNotes) => updateDraftHandover({ generalNotes })} />,
    <Section8SignOff
      key="signoff"
      supervisorName={profile?.fullName ?? 'Supervisor'}
      shiftName={draft.shiftName}
      acknowledged={draft.outgoingAcknowledged}
      onAcknowledge={(outgoingAcknowledged) => updateDraftHandover({ outgoingAcknowledged })}
      submitting={submitting}
      error={submitError}
      onSubmit={() => void handleSubmit()}
    />,
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto lg:hidden">
        {STEPS.map((label, index) => (
          <button key={label} type="button" onClick={() => setStep(index)} className={`min-h-12 shrink-0 rounded-full border px-3 text-xs font-semibold ${step === index ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
            {index + 1}. {label}
          </button>
        ))}
      </div>
      <div className="lg:hidden">{sections[step]}</div>
      <div className="hidden space-y-6 lg:block">{sections}</div>
      <div className="sticky bottom-0 flex justify-between gap-2 border-t border-slate-200 bg-slate-50 p-3 lg:hidden">
        <button type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)} className="min-h-12 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50">Back</button>
        <button type="button" disabled={step === sections.length - 1} onClick={() => setStep((value) => value + 1)} className="min-h-12 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}

export default HandoverCreateForm;
