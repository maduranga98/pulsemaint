import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TriageStep, TriageLanguage, TriageStepOption } from '../../../types/triage';
import StatementStep from './step-types/StatementStep';
import YesNoStep from './step-types/YesNoStep';
import MultipleChoiceStep from './step-types/MultipleChoiceStep';
import PhotoCaptureStep from './step-types/PhotoCaptureStep';
import NumberInputStep from './step-types/NumberInputStep';
import TextInputStep from './step-types/TextInputStep';
import ChecklistStep from './step-types/ChecklistStep';
import ReferenceMediaViewer from './ReferenceMediaViewer';
import TriageStepNotes from './TriageStepNotes';
import type { TriageMediaRef } from '../../../types/triage';

interface StepResult {
  response: boolean | string | string[] | number | null;
  photoUrls: string[];
  nextStepId?: string | null;
}

interface Props {
  step: TriageStep;
  language: TriageLanguage;
  onComplete: (result: StepResult) => void;
  onEscalate: () => void;
}

export default function TriageStepDisplay({ step, language, onComplete, onEscalate }: Props) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  const [viewMedia, setViewMedia] = useState<TriageMediaRef | null>(null);

  const wrap = (response: boolean | string | string[] | number | null, photoUrls: string[] = [], nextStepId?: string | null): StepResult => ({
    response,
    photoUrls,
    nextStepId,
  });

  const handleYesNo = (value: boolean, nextStepId: string | null) =>
    onComplete(wrap(value, [], nextStepId));

  const handleOption = (opt: TriageStepOption) => {
    if (opt.isEscalate) {
      onEscalate();
    } else {
      onComplete(wrap(opt.label, [], opt.nextStepId));
    }
  };

  return (
    <div className="px-4 pb-4">
      {step.isEscalationStep && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-sm font-medium">
          {t('triage.escalation_warning')}
        </div>
      )}

      {step.mediaRefs.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">{t('triage.reference_media')}</p>
          <div className="flex gap-2 flex-wrap">
            {step.mediaRefs.map((m, i) => (
              <button key={i} onClick={() => setViewMedia(m)} className="relative">
                <img src={m.url} alt={m.caption} className="w-20 h-20 object-cover rounded-lg border" />
                {m.type === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-2xl">▶</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {step.type === 'statement' && (
        <StatementStep step={step} language={language} onConfirm={() => onComplete(wrap(null))} />
      )}
      {step.type === 'yes_no' && (
        <YesNoStep step={step} language={language} onAnswer={handleYesNo} />
      )}
      {step.type === 'multiple_choice' && (
        <MultipleChoiceStep step={step} language={language} onSelect={handleOption} />
      )}
      {step.type === 'photo_required' && (
        <PhotoCaptureStep step={step} language={language} onComplete={(photos) => onComplete(wrap(null, photos))} />
      )}
      {step.type === 'number_input' && (
        <NumberInputStep step={step} language={language} onComplete={(val) => onComplete(wrap(val))} />
      )}
      {step.type === 'text_input' && (
        <TextInputStep step={step} language={language} onComplete={(val) => onComplete(wrap(val))} />
      )}
      {step.type === 'checklist' && (
        <ChecklistStep step={step} language={language} onComplete={(ids) => onComplete(wrap(ids))} />
      )}

      <TriageStepNotes value={notes} onChange={setNotes} />

      {viewMedia && (
        <ReferenceMediaViewer media={viewMedia} onClose={() => setViewMedia(null)} />
      )}
    </div>
  );
}
