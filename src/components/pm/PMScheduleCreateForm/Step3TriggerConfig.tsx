import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreatePMFormValues } from '../../../schemas/pm';
import { RECURRENCE_TYPE_LABELS, TRIGGER_UNIT_LABELS } from '../../../constants/pmConfig';

export function Step3TriggerConfig() {
  const { t } = useTranslation();
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreatePMFormValues>();
  const triggerType = watch('triggerType');
  const recurrenceType = watch('recurrenceType');
  const noEndDate = watch('noEndDate');
  const seasonalOverride = watch('seasonalOverride');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{t('common.pmSchedules.createForm.step3.heading')}</h3>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            value="calendar"
            checked={triggerType === 'calendar'}
            onChange={() => setValue('triggerType', 'calendar')}
            className="text-blue-600"
          />
          <span className="text-sm font-medium">{t('common.pmSchedules.createForm.step3.calendarBased')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            value="usage"
            checked={triggerType === 'usage'}
            onChange={() => setValue('triggerType', 'usage')}
            className="text-blue-600"
          />
          <span className="text-sm font-medium">{t('common.pmSchedules.createForm.step3.usageBased')}</span>
        </label>
      </div>

      {triggerType === 'calendar' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step3.firstPmDateLabel')}</label>
            <input
              {...register('firstDueDate', { valueAsDate: true })}
              type="datetime-local"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.firstDueDate && <p className="text-xs text-red-500 mt-1">{errors.firstDueDate.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step3.recurrenceLabel')}</label>
            <select
              {...register('recurrenceType')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {Object.keys(RECURRENCE_TYPE_LABELS).map((key) => (
                <option key={key} value={key}>{t(`common.pmSchedules.recurrence.${key}`)}</option>
              ))}
            </select>
          </div>

          {recurrenceType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step3.everyXDays')}</label>
              <input
                {...register('customIntervalDays', { valueAsNumber: true })}
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {errors.customIntervalDays && <p className="text-xs text-red-500 mt-1">{errors.customIntervalDays.message}</p>}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              {...register('noEndDate')}
              type="checkbox"
              id="noEndDate"
              className="rounded border-gray-300"
            />
            <label htmlFor="noEndDate" className="text-sm text-gray-700">{t('common.pmSchedules.createForm.step3.noEndDate')}</label>
          </div>

          {!noEndDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step3.endDateLabel')}</label>
              <input
                {...register('endDate', { valueAsDate: true })}
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          {/* Seasonal Override */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2">
              <input
                {...register('seasonalOverride')}
                type="checkbox"
                id="seasonalOverride"
                className="rounded border-gray-300"
              />
              <label htmlFor="seasonalOverride" className="text-sm font-medium text-gray-700">{t('common.pmSchedules.createForm.step3.seasonalOverride')}</label>
            </div>
            {seasonalOverride && (
              <div className="mt-3 space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('common.pmSchedules.createForm.step3.peakSeasonStart')}</label>
                    <input
                      {...register('peakSeasonStart', { valueAsDate: true })}
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{t('common.pmSchedules.createForm.step3.peakSeasonEnd')}</label>
                    <input
                      {...register('peakSeasonEnd', { valueAsDate: true })}
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">{t('common.pmSchedules.createForm.step3.peakSeasonInterval')}</label>
                  <select
                    {...register('peakSeasonInterval')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    {Object.keys(RECURRENCE_TYPE_LABELS).map((key) => (
                      <option key={key} value={key}>{t(`common.pmSchedules.recurrence.${key}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {triggerType === 'usage' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step3.triggerAfterLabel')}</label>
              <input
                {...register('triggerAfterValue', { valueAsNumber: true })}
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {errors.triggerAfterValue && <p className="text-xs text-red-500 mt-1">{errors.triggerAfterValue.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step3.unitLabel')}</label>
              <select
                {...register('triggerUnit')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">{t('common.pmSchedules.createForm.step3.selectUnitPlaceholder')}</option>
                {Object.keys(TRIGGER_UNIT_LABELS).map((key) => (
                  <option key={key} value={key}>{t(`common.pmSchedules.triggerUnits.${key}`)}</option>
                ))}
              </select>
              {errors.triggerUnit && <p className="text-xs text-red-500 mt-1">{errors.triggerUnit.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step3.currentMeterValue')}</label>
            <input
              {...register('currentMeterValue', { valueAsNumber: true })}
              type="number"
              min={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step3.lastMeterResetDate')}</label>
            <input
              {...register('lastMeterResetDate', { valueAsDate: true })}
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
