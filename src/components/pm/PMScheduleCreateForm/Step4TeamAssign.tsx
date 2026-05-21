import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { CreatePMFormValues } from '../../../schemas/pm';
import { PM_SKILLS_OPTIONS } from '../../../constants/pmConfig';

export function Step4TeamAssign() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreatePMFormValues>();
  const assignedTechnicianIds = watch('assignedTechnicianIds') || [];
  const assignedTechnicianNames = watch('assignedTechnicianNames') || [];
  const skillsRequired = watch('skillsRequired') || [];
  const [newTechName, setNewTechName] = useState('');

  const addTechnician = () => {
    const trimmed = newTechName.trim();
    if (!trimmed) return;
    const id = `tech-${Date.now()}`;
    setValue('assignedTechnicianIds', [...assignedTechnicianIds, id]);
    setValue('assignedTechnicianNames', [...assignedTechnicianNames, trimmed]);
    setNewTechName('');
  };

  const removeTechnician = (index: number) => {
    const newIds = assignedTechnicianIds.filter((_, i) => i !== index);
    const newNames = assignedTechnicianNames.filter((_, i) => i !== index);
    setValue('assignedTechnicianIds', newIds);
    setValue('assignedTechnicianNames', newNames);
  };

  const toggleSkill = (skill: string) => {
    const current = [...skillsRequired];
    const idx = current.indexOf(skill);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(skill);
    setValue('skillsRequired', current);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Team Assignment</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Technicians *</label>
        
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newTechName}
            onChange={(e) => setNewTechName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnician())}
            placeholder="Enter technician name"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="button"
            onClick={addTechnician}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Add
          </button>
        </div>

        {assignedTechnicianNames.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {assignedTechnicianNames.map((name, index) => (
              <span
                key={assignedTechnicianIds[index] || index}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeTechnician(index)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {errors.assignedTechnicianIds && (
          <p className="text-xs text-red-500 mt-1">{errors.assignedTechnicianIds.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration *</label>
          <input
            {...register('estimatedDuration', { valueAsNumber: true })}
            type="number"
            min={0.5}
            step={0.5}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
          <select
            {...register('estimatedDurationUnit')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Skills Required</label>
        <div className="flex flex-wrap gap-2">
          {PM_SKILLS_OPTIONS.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                skillsRequired.includes(skill)
                  ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {skillsRequired.includes(skill) && '✓ '}
              {skill}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
