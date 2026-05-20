import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TriageStep, TriageLanguage } from '../../../../types/triage';

interface Props {
  step: TriageStep;
  language: TriageLanguage;
  onComplete: (checked: string[]) => void;
}

export default function ChecklistStep({ step, language, onComplete }: Props) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const title = step.translations?.[language]?.title ?? step.title;
  const instruction = step.translations?.[language]?.instruction ?? step.instruction;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const requiredIds = step.checklistItems.filter((i) => i.required).map((i) => i.id);
  const allRequiredDone = requiredIds.every((id) => checked.has(id));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[22px] font-bold font-['Sora'] text-[#0A1628]">{title}</h2>
      <p className="text-[20px] leading-relaxed text-gray-700">{instruction}</p>

      <div className="flex flex-col gap-3 mt-2">
        {step.checklistItems.map((item) => (
          <label
            key={item.id}
            className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border-2 border-gray-200 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={checked.has(item.id)}
              onChange={() => toggle(item.id)}
              className="w-6 h-6 mt-0.5 accent-[#1A56DB] cursor-pointer"
            />
            <span className="text-[18px] text-gray-800 flex-1">
              {item.text}
              {item.required && (
                <span className="ml-2 text-xs text-red-500 font-medium">
                  {t('triage.required')}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      <button
        onClick={() => onComplete(Array.from(checked))}
        disabled={!allRequiredDone}
        className="w-full min-h-[56px] bg-[#1A56DB] text-white text-[18px] font-semibold rounded-xl mt-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-[0.98] transition-all"
      >
        {t('triage.next_step')}
      </button>
    </div>
  );
}
