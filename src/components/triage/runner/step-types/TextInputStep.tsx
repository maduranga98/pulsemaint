import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TriageStep, TriageLanguage } from '../../../../types/triage';

interface Props {
  step: TriageStep;
  language: TriageLanguage;
  onComplete: (value: string) => void;
}

export default function TextInputStep({ step, language, onComplete }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const title = step.translations?.[language]?.title ?? step.title;
  const instruction = step.translations?.[language]?.instruction ?? step.instruction;
  const maxChars = step.maxChars ?? 500;
  const canProceed = value.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[22px] font-bold font-['Sora'] text-[#0A1628]">{title}</h2>
      <p className="text-[20px] leading-relaxed text-gray-700">{instruction}</p>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, maxChars))}
        placeholder={step.placeholder ?? ''}
        rows={5}
        className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-[18px] focus:outline-none focus:ring-2 focus:ring-[#1A56DB] resize-none"
      />
      <p className="text-xs text-gray-400 text-right">
        {t('triage.char_count', { count: value.length, max: maxChars })}
      </p>

      <button
        onClick={() => canProceed && onComplete(value)}
        disabled={!canProceed}
        className="w-full min-h-[56px] bg-[#1A56DB] text-white text-[18px] font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-[0.98] transition-all"
      >
        {t('triage.next_step')}
      </button>
    </div>
  );
}
