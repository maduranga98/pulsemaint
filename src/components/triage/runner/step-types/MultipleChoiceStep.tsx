import type { TriageStep, TriageLanguage, TriageStepOption } from '../../../../types/triage';

interface Props {
  step: TriageStep;
  language: TriageLanguage;
  onSelect: (option: TriageStepOption) => void;
}

export default function MultipleChoiceStep({ step, language, onSelect }: Props) {
  const title = step.translations?.[language]?.title ?? step.title;
  const instruction = step.translations?.[language]?.instruction ?? step.instruction;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[22px] font-bold font-['Sora'] text-[#0A1628]">{title}</h2>
      <p className="text-[20px] leading-relaxed text-gray-700">{instruction}</p>
      <div className="flex flex-col gap-3 mt-4">
        {step.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelect(opt)}
            className={`w-full min-h-[56px] px-5 text-left text-[18px] font-medium rounded-xl border-2 transition-all active:scale-[0.98] ${
              opt.isEscalate
                ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'
                : opt.isSafe
                ? 'border-green-400 bg-green-50 text-green-800 hover:bg-green-100'
                : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
            }`}
          >
            {opt.translations?.[language]?.label ?? opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
