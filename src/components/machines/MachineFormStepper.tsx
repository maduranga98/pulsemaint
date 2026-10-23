export interface FormStep {
  id: string;
  label: string;
  description?: string;
}

interface MachineFormStepperProps {
  steps: FormStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  isDesktop?: boolean;
}

export function MachineFormStepper({
  steps,
  currentStep,
  onStepChange,
  isDesktop = false,
}: MachineFormStepperProps) {
  if (isDesktop) {
    // Desktop: vertical stepper on the left
    return (
      <div className="space-y-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => onStepChange(index)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
              index === currentStep
                ? 'bg-[#13294A] border border-blue-400 text-[#F0F4F8]'
                : index < currentStep
                  ? 'bg-[#0F2A24] border border-emerald-500/60 text-[#F0F4F8]'
                  : 'bg-[#0F1E35] border border-[#1E3A5F] text-[#F0F4F8]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  index === currentStep
                    ? 'bg-blue-600 text-white'
                    : index < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-[#1E3A5F] text-[#F0F4F8]'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              <div>
                <div className="font-medium">{step.label}</div>
                {step.description && <div className="text-xs text-[#8BA3BF]">{step.description}</div>}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Mobile: progress bar
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-[#F0F4F8]">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="text-sm text-[#8BA3BF]">{steps[currentStep].label}</span>
      </div>
      <div className="w-full h-2 bg-[#1E3A5F] rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
