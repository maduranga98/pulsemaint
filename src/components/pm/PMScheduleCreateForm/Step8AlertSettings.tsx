import { useFormContext } from 'react-hook-form';
import type { CreatePMFormValues } from '../../../schemas/pm';

export function Step8AlertSettings() {
  const { register } = useFormContext<CreatePMFormValues>();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Settings & Alerts</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lead Time (days)
          </label>
          <input
            {...register('leadTimeDays', { valueAsNumber: true })}
            type="number"
            min={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Days before due to notify technician</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Overdue Escalation (hours)
          </label>
          <input
            {...register('overdueEscalationHours', { valueAsNumber: true })}
            type="number"
            min={1}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Hours after due to escalate to Plant Manager</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auto-Close (days)
          </label>
          <input
            {...register('autoCloseAfterDays', { valueAsNumber: true })}
            type="number"
            min={1}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Days to auto-flag as overdue</p>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-blue-900">Notification Summary</p>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>Push + Email to assigned technician and supervisor when PM is due</li>
          <li>Push + SMS to Plant Manager if PM is not started within escalation hours</li>
          <li>Immediate push when PM Work Order is auto-created</li>
        </ul>
      </div>
    </div>
  );
}
