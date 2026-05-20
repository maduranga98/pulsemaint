import { Check } from 'lucide-react';

interface ImportStepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4 | 5;
}

const STEPS = [
  { number: 1, label: 'Template' },
  { number: 2, label: 'Upload' },
  { number: 3, label: 'Validate' },
  { number: 4, label: 'Import' },
  { number: 5, label: 'Complete' },
];

export function ImportStepIndicator({ currentStep }: ImportStepIndicatorProps) {
  return (
    <div className="flex items-center justify-center w-full mb-8">
      {STEPS.map((step, idx) => {
        const isCompleted = step.number < currentStep;
        const isCurrent = step.number === currentStep;
        const isFuture = step.number > currentStep;

        return (
          <div key={step.number} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                  ${isFuture ? 'bg-gray-200 text-gray-500' : ''}
                `}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{step.number}</span>
                )}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap
                  ${isCurrent ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-400'}
                `}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 sm:w-20 mx-1 mb-5 transition-colors
                  ${step.number < currentStep ? 'bg-green-400' : 'bg-gray-200'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
