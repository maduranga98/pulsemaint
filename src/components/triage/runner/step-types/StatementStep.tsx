import { useTranslation } from 'react-i18next';
import type { TriageStep } from '../../../../types/triage';
import type { TriageLanguage } from '../../../../types/triage';

interface Props {
  step: TriageStep;
  language: TriageLanguage;
  onConfirm: () => void;
}

export default function StatementStep({ step, language, onConfirm }: Props) {
  const { t } = useTranslation();
  const title = step.translations?.[language]?.title ?? step.title;
  const instruction = step.translations?.[language]?.instruction ?? step.instruction;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[22px] font-bold font-['Sora'] text-[#0A1628]">{title}</h2>
      <p className="text-[20px] leading-relaxed text-gray-700">{instruction}</p>
      <button
        onClick={onConfirm}
        className="w-full min-h-[56px] bg-[#1A56DB] text-white text-[18px] font-semibold rounded-xl mt-4 hover:bg-blue-700 active:scale-[0.98] transition-all"
      >
        {t('triage.confirm')}
      </button>
    </div>
  );
}
