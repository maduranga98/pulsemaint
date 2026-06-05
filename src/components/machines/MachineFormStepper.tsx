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
                ? 'bg-blue-50 border border-blue-300 text-blue-900'
                : index < currentStep
                  ? 'bg-green-50 border border-green-300 text-green-900'
                  : 'bg-gray-50 border border-gray-200 text-gray-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  index === currentStep
                    ? 'bg-blue-600 text-white'
                    : index < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-300 text-gray-700'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              <div>
                <div className="font-medium">{step.label}</div>
                {step.description && <div className="text-xs opacity-75">{step.description}</div>}
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
        <span className="text-sm font-medium text-gray-700">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="text-sm text-gray-600">{steps[currentStep].label}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
