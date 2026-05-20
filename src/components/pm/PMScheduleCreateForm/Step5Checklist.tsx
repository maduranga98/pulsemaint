import { useFormContext } from 'react-hook-form';
import type { CreatePMFormValues } from '../../../schemas/pm';
import { PMChecklistBuilder } from '../PMChecklistBuilder';

export function Step5Checklist() {
  const { watch, setValue, formState: { errors } } = useFormContext<CreatePMFormValues>();
  const checklistItems = watch('checklistItems') || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">PM Checklist</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              // Placeholder for template library
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Use existing template
          </button>
          <button
            type="button"
            onClick={() => {
              // Placeholder for save template
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Save as template
          </button>
        </div>
      </div>

      <PMChecklistBuilder
        items={checklistItems.map((item, index) => ({
          id: `step-${index + 1}`,
          step: item.step,
          description: item.description,
          estimatedMinutes: item.estimatedMinutes,
          photoRequired: item.photoRequired,
        }))}
        onChange={(items) => setValue('checklistItems', items)}
      />

      {errors.checklistItems && (
        <p className="text-xs text-red-500">{errors.checklistItems.message}</p>
      )}
    </div>
  );
}
