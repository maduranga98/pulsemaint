import { useTranslation } from 'react-i18next';

interface ContractorFormStepperProps {
  step: number;
  onStepChange: (step: number) => void;
}

const STEP_KEYS = ['company', 'contacts', 'specializations', 'financial', 'documents'];

export function ContractorFormStepper({ step, onStepChange }: ContractorFormStepperProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2 overflow-x-auto">
      {STEP_KEYS.map((key, index) => (
        <button key={key} type="button" onClick={() => onStepChange(index)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${step === index ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
          {index + 1}. {t(`common.contractors.registry.formStepper.steps.${key}`)}
        </button>
      ))}
    </div>
  );
}

export default ContractorFormStepper;
