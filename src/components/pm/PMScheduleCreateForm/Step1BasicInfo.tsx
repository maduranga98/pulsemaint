import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreatePMFormValues } from '../../../schemas/pm';
import { PM_TYPE_CONFIG, PM_TYPES_ORDERED } from '../../../constants/pmConfig';

export function Step1BasicInfo() {
  const { t } = useTranslation();
  const { register, formState: { errors } } = useFormContext<CreatePMFormValues>();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{t('common.pmSchedules.createForm.step1.heading')}</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step1.nameLabel')}</label>
        <input
          {...register('name')}
          type="text"
          placeholder={t('common.pmSchedules.createForm.step1.namePlaceholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step1.pmTypeLabel')}</label>
          <select
            {...register('pmType')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {PM_TYPES_ORDERED.map((type) => (
              <option key={type} value={type}>
                {PM_TYPE_CONFIG[type].icon} {t(`common.pmSchedules.types.${type}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step1.priorityLabel')}</label>
          <select
            {...register('priority')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
              <option key={p} value={p}>
                {t(`common.workOrders.priorities.${p}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step1.descriptionLabel')}</label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder={t('common.pmSchedules.createForm.step1.descriptionPlaceholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
        />
      </div>
    </div>
  );
}
