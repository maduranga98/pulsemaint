import { useTranslation } from 'react-i18next';
import type { TriageStep, TriageLanguage } from '../../../../types/triage';

interface Props {
  step: TriageStep;
  language: TriageLanguage;
  onAnswer: (value: boolean, nextStepId: string | null) => void;
}

export default function YesNoStep({ step, language, onAnswer }: Props) {
  const { t } = useTranslation();
  const title = step.translations?.[language]?.title ?? step.title;
  const instruction = step.translations?.[language]?.instruction ?? step.instruction;

  const yesOpt = step.options.find((o) => o.isSafe) ?? step.options[0];
  const noOpt = step.options.find((o) => !o.isSafe) ?? step.options[1];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[22px] font-bold font-['Sora'] text-[#0A1628]">{title}</h2>
      <p className="text-[20px] leading-relaxed text-gray-700">{instruction}</p>
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => onAnswer(true, yesOpt?.nextStepId ?? null)}
          className="flex-1 min-h-[56px] bg-[#10B981] text-white text-[20px] font-bold rounded-xl hover:bg-green-600 active:scale-[0.98] transition-all"
        >
          {yesOpt?.translations?.[language]?.label ?? t('triage.yes')}
        </button>
        <button
          onClick={() => onAnswer(false, noOpt?.nextStepId ?? null)}
          className="flex-1 min-h-[56px] bg-[#EF4444] text-white text-[20px] font-bold rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all"
        >
          {noOpt?.translations?.[language]?.label ?? t('triage.no')}
        </button>
      </div>
    </div>
  );
}
