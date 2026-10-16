import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreatePMFormValues } from '../../../schemas/pm';
import { PM_SKILLS_OPTIONS } from '../../../constants/pmConfig';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import { useBusyTechnicians } from '../../../hooks/useBusyTechnicians';
import { sameDepartment } from '../../../hooks/useRecordPlantMatcher';

interface TechOption {
  id: string;
  name: string;
  department?: string;
  plantId: string | null;
}

export function Step4TeamAssign() {
  const { t } = useTranslation();
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreatePMFormValues>();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId;
  const siteId = userProfile?.siteIds?.[0] || companyId;
  const assignedTechnicianIds = watch('assignedTechnicianIds') || [];
  const assignedTechnicianNames = watch('assignedTechnicianNames') || [];
  const skillsRequired = watch('skillsRequired') || [];
  const machineDepartment = watch('department');
  const machinePlantId = watch('plantId');
  const [pool, setPool] = useState<TechOption[]>([]);
  const [search, setSearch] = useState('');

  // Same pool and scoping as a Work Order's team: technicians/trainees of the
  // machine's plant and department.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    getDocs(collection(db, `companies/${companyId}/users`))
      .then((snap) => {
        if (cancelled) return;
        setPool(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string })
            .filter((u) => u.role === 'technician' || u.role === 'trainee')
            .map((u) => ({
              id: u.id,
              name: `${(u.fullName as string) ?? (u.email as string) ?? u.id}${u.role === 'trainee' ? ' (Trainee)' : ''}`,
              department: u.department as string | undefined,
              plantId: (u.plantId as string | null | undefined) ?? null,
            })),
        );
      })
      .catch(() => !cancelled && setPool([]));
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Technicians mid-job (a started WO, or an unsubmitted breakdown) can't be
  // given another, exactly as when a Work Order is created.
  const { busy } = useBusyTechnicians(siteId);

  const options = pool
    .filter((u) => (!machinePlantId || u.plantId === machinePlantId) && (!machineDepartment || sameDepartment(u.department, machineDepartment)))
    .filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()));

  const toggleTechnician = (tech: TechOption) => {
    const index = assignedTechnicianIds.indexOf(tech.id);
    if (index >= 0) {
      removeTechnician(index);
    } else {
      setValue('assignedTechnicianIds', [...assignedTechnicianIds, tech.id]);
      setValue('assignedTechnicianNames', [...assignedTechnicianNames, tech.name]);
    }
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
      <h3 className="text-lg font-semibold text-gray-900">{t('common.pmSchedules.createForm.step4.heading')}</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.pmSchedules.createForm.step4.assignedTechniciansLabel')}</label>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.workOrders.copy.techniciansPlaceholder')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-2"
        />
        <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-gray-100 mb-3">
          {options.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">{t('common.workOrders.teamAssignment.noTechniciansFound')}</p>
          ) : (
            options.map((tech) => {
              const selected = assignedTechnicianIds.includes(tech.id);
              const job = busy.get(tech.id);
              // Someone already on the schedule can still be removed.
              const unavailable = !!job && !selected;
              return (
                <button
                  key={tech.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => toggleTechnician(tech)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    unavailable ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'hover:bg-gray-50'
                  } ${selected ? 'bg-blue-50' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-5 w-5 rounded border-2 flex items-center justify-center ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                      {selected && <span className="text-white text-xs">✓</span>}
                    </span>
                    <span className="font-medium">{tech.name}</span>
                    <span className="text-gray-400">{tech.department}</span>
                  </span>
                  {job && <span className="text-xs text-amber-700">{t('common.workOrders.teamAssignment.busyInline', { ref: job.ref })}</span>}
                </button>
              );
            })
          )}
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
                  aria-label={t('common.pmSchedules.createForm.step4.removeTechnician', { name })}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step4.estimatedDurationLabel')}</label>
          <input
            {...register('estimatedDuration', { valueAsNumber: true })}
            type="number"
            min={0.5}
            step={0.5}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.pmSchedules.createForm.step4.unitLabel')}</label>
          <select
            {...register('estimatedDurationUnit')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="hours">{t('common.pmSchedules.createForm.step4.hours')}</option>
            <option value="days">{t('common.pmSchedules.createForm.step4.days')}</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.pmSchedules.createForm.step4.skillsRequiredLabel')}</label>
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
              {t(`common.pmSchedules.skills.${skill}`, { defaultValue: skill })}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
