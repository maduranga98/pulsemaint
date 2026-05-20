import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TriageStep, TriageLanguage } from '../../../../types/triage';

interface Props {
  step: TriageStep;
  language: TriageLanguage;
  onComplete: (value: number) => void;
}

export default function NumberInputStep({ step, language, onComplete }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const title = step.translations?.[language]?.title ?? step.title;
  const instruction = step.translations?.[language]?.instruction ?? step.instruction;
  const num = parseFloat(value);
  const isOutOfRange =
    value !== '' &&
    !isNaN(num) &&
    step.normalMin !== undefined &&
    step.normalMax !== undefined &&
    (num < step.normalMin || num > step.normalMax);
  const canProceed = value !== '' && !isNaN(num);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[22px] font-bold font-['Sora'] text-[#0A1628]">{title}</h2>
      <p className="text-[20px] leading-relaxed text-gray-700">{instruction}</p>

      <div className="mt-2">
        {step.fieldLabel && (
          <label className="block text-sm font-medium text-gray-600 mb-1">
            {step.fieldLabel} {step.unit && <span className="text-gray-400">({step.unit})</span>}
          </label>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={step.placeholder ?? '0'}
          className={`w-full text-[24px] font-bold border-2 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1A56DB] ${
            isOutOfRange ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
        />
        {step.normalMin !== undefined && step.normalMax !== undefined && (
          <p className="text-sm text-gray-500 mt-1">
            {t('triage.normal_range', {
              min: step.normalMin,
              max: step.normalMax,
              unit: step.unit ?? '',
            })}
          </p>
        )}
        {isOutOfRange && (
          <p className="text-sm text-red-600 font-semibold mt-1">{t('triage.out_of_range')}</p>
        )}
      </div>

      <button
        onClick={() => canProceed && onComplete(num)}
        disabled={!canProceed}
        className="w-full min-h-[56px] bg-[#1A56DB] text-white text-[18px] font-semibold rounded-xl mt-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-[0.98] transition-all"
      >
        {t('triage.next_step')}
      </button>
    </div>
  );
}
