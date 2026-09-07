import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreatePMFormValues } from '../../../schemas/pm';

export function Step8AlertSettings() {
  const { t } = useTranslation();
  const { register } = useFormContext<CreatePMFormValues>();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{t('common.pmSchedules.createForm.step8.heading')}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('common.pmSchedules.createForm.step8.leadTimeLabel')}
          </label>
          <input
            {...register('leadTimeDays', { valueAsNumber: true })}
            type="number"
            min={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">{t('common.pmSchedules.createForm.step8.leadTimeHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('common.pmSchedules.createForm.step8.overdueEscalationLabel')}
          </label>
          <input
            {...register('overdueEscalationHours', { valueAsNumber: true })}
            type="number"
            min={1}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">{t('common.pmSchedules.createForm.step8.overdueEscalationHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('common.pmSchedules.createForm.step8.autoCloseLabel')}
          </label>
          <input
            {...register('autoCloseAfterDays', { valueAsNumber: true })}
            type="number"
            min={1}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">{t('common.pmSchedules.createForm.step8.autoCloseHint')}</p>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-blue-900">{t('common.pmSchedules.createForm.step8.notificationSummaryTitle')}</p>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>{t('common.pmSchedules.createForm.step8.notif1')}</li>
          <li>{t('common.pmSchedules.createForm.step8.notif2')}</li>
          <li>{t('common.pmSchedules.createForm.step8.notif3')}</li>
        </ul>
      </div>
    </div>
  );
}
