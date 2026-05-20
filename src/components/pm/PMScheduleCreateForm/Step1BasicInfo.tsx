import { useFormContext } from 'react-hook-form';
import type { CreatePMFormValues } from '../../../schemas/pm';
import { PM_TYPE_CONFIG, PM_TYPES_ORDERED, PM_PRIORITY_CONFIG } from '../../../constants/pmConfig';

export function Step1BasicInfo() {
  const { register, formState: { errors } } = useFormContext<CreatePMFormValues>();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Schedule Identity</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name *</label>
        <input
          {...register('name')}
          type="text"
          placeholder="e.g. Loom Machine Monthly Lubrication"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PM Type *</label>
          <select
            {...register('pmType')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {PM_TYPES_ORDERED.map((type) => (
              <option key={type} value={type}>
                {PM_TYPE_CONFIG[type].icon} {PM_TYPE_CONFIG[type].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            {...register('priority')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
              <option key={p} value={p}>
                {PM_PRIORITY_CONFIG[p].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          {...register('description')}
          rows={3}
          placeholder="What must be done during this PM?"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
        />
      </div>
    </div>
  );
}
