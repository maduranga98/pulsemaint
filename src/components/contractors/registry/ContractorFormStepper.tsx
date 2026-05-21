interface ContractorFormStepperProps {
  step: number;
  onStepChange: (step: number) => void;
}

const STEPS = ['Company', 'Contacts', 'Specializations', 'Financial', 'Documents'];

export function ContractorFormStepper({ step, onStepChange }: ContractorFormStepperProps) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {STEPS.map((label, index) => (
        <button key={label} type="button" onClick={() => onStepChange(index)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${step === index ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>
          {index + 1}. {label}
        </button>
      ))}
    </div>
  );
}

export default ContractorFormStepper;
