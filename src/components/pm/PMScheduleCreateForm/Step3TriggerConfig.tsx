import { useFormContext } from 'react-hook-form';
import type { CreatePMFormValues } from '../../../schemas/pm';
import { RECURRENCE_TYPE_LABELS, TRIGGER_UNIT_LABELS } from '../../../constants/pmConfig';

export function Step3TriggerConfig() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreatePMFormValues>();
  const triggerType = watch('triggerType');
  const recurrenceType = watch('recurrenceType');
  const noEndDate = watch('noEndDate');
  const seasonalOverride = watch('seasonalOverride');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Trigger Configuration</h3>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            value="calendar"
            checked={triggerType === 'calendar'}
            onChange={() => setValue('triggerType', 'calendar')}
            className="text-blue-600"
          />
          <span className="text-sm font-medium">Calendar-Based</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            value="usage"
            checked={triggerType === 'usage'}
            onChange={() => setValue('triggerType', 'usage')}
            className="text-blue-600"
          />
          <span className="text-sm font-medium">Usage-Based</span>
        </label>
      </div>

      {triggerType === 'calendar' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First PM Date *</label>
            <input
              {...register('firstDueDate', { valueAsDate: true })}
              type="datetime-local"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {errors.firstDueDate && <p className="text-xs text-red-500 mt-1">{errors.firstDueDate.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence *</label>
            <select
              {...register('recurrenceType')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              {Object.entries(RECURRENCE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {recurrenceType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Every X Days</label>
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
            <label htmlFor="noEndDate" className="text-sm text-gray-700">No End Date (run indefinitely)</label>
          </div>

          {!noEndDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
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
              <label htmlFor="seasonalOverride" className="text-sm font-medium text-gray-700">Seasonal Override</label>
            </div>
            {seasonalOverride && (
              <div className="mt-3 space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Peak Season Start</label>
                    <input
                      {...register('peakSeasonStart', { valueAsDate: true })}
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Peak Season End</label>
                    <input
                      {...register('peakSeasonEnd', { valueAsDate: true })}
                      type="date"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Peak Season Interval</label>
                  <select
                    {...register('peakSeasonInterval')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    {Object.entries(RECURRENCE_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Trigger After *</label>
              <input
                {...register('triggerAfterValue', { valueAsNumber: true })}
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {errors.triggerAfterValue && <p className="text-xs text-red-500 mt-1">{errors.triggerAfterValue.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <select
                {...register('triggerUnit')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Select...</option>
                {Object.entries(TRIGGER_UNIT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              {errors.triggerUnit && <p className="text-xs text-red-500 mt-1">{errors.triggerUnit.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Meter Value</label>
            <input
              {...register('currentMeterValue', { valueAsNumber: true })}
              type="number"
              min={0}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Meter Reset Date</label>
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
