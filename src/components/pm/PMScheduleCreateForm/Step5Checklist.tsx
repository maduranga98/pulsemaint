import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreatePMFormValues } from '../../../schemas/pm';
import { PMChecklistBuilder } from '../PMChecklistBuilder';

export function Step5Checklist() {
  const { t } = useTranslation();
  const { watch, setValue, formState: { errors } } = useFormContext<CreatePMFormValues>();
  const checklistItems = watch('checklistItems') || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{t('common.pmSchedules.createForm.step5.heading')}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              // Placeholder for template library
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {t('common.pmSchedules.createForm.step5.useExistingTemplate')}
          </button>
          <button
            type="button"
            onClick={() => {
              // Placeholder for save template
            }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {t('common.pmSchedules.createForm.step5.saveAsTemplate')}
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
          inputType: item.inputType ?? 'checkbox',
          method: item.method ?? null,
          unit: item.unit ?? null,
          acceptableMin: item.acceptableMin ?? null,
          acceptableMax: item.acceptableMax ?? null,
        }))}
        onChange={(items) => setValue('checklistItems', items)}
      />

      {errors.checklistItems && (
        <p className="text-xs text-red-500">{errors.checklistItems.message}</p>
      )}
    </div>
  );
}
