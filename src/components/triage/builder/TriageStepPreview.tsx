import type { TriageStep } from '../../../types/triage';
import TriageSafetyBanner from '../runner/TriageSafetyBanner';
import StatementStep from '../runner/step-types/StatementStep';
import YesNoStep from '../runner/step-types/YesNoStep';
import MultipleChoiceStep from '../runner/step-types/MultipleChoiceStep';

interface Props {
  step: TriageStep | null;
}

export default function TriageStepPreview({ step }: Props) {
  if (!step) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
        <p>Select a step to preview</p>
      </div>
    );
  }

  return (
    <div className="w-[390px] max-w-full mx-auto border-4 border-gray-800 rounded-[32px] overflow-hidden shadow-xl bg-white">
      <div className="bg-[#0A1628] h-6 flex items-center justify-center">
        <div className="w-16 h-1.5 bg-gray-600 rounded-full" />
      </div>
      <TriageSafetyBanner level={step.safetyLevel} />
      <div className="px-4 py-4 min-h-[500px]">
        {step.type === 'statement' && (
          <StatementStep step={step} language="en" onConfirm={() => {}} />
        )}
        {step.type === 'yes_no' && (
          <YesNoStep step={step} language="en" onAnswer={() => {}} />
        )}
        {step.type === 'multiple_choice' && (
          <MultipleChoiceStep step={step} language="en" onSelect={() => {}} />
        )}
        {!['statement', 'yes_no', 'multiple_choice'].includes(step.type) && (
          <div className="text-center mt-8 text-gray-400 text-sm">
            <p className="font-semibold text-[#0A1628] text-xl">{step.title}</p>
            <p className="text-gray-600 mt-2 text-base">{step.instruction}</p>
          </div>
        )}
      </div>
    </div>
  );
}
