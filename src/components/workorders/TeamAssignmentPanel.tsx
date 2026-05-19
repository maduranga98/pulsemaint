import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { WO_COPY } from '../../constants/copy';

// Stub types — replace with real data from Module 3 / users collection
interface TechnicianOption {
  id: string;
  name: string;
  department: string;
  activeWOCount: number;
}

interface ContractorOption {
  id: string;
  companyName: string;
  specializations: string[];
  rating: number;
  lastJobDate: string | null;
  contactPerson: string;
  contactNumber: string;
  isActive: boolean;
}

interface TeamAssignmentPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  isContractorWO: boolean;
  technicians: TechnicianOption[];
  contractors: ContractorOption[];
}

export function TeamAssignmentPanel({
  form,
  isContractorWO,
  technicians,
  contractors,
}: TeamAssignmentPanelProps) {
  const { register, watch, setValue, formState: { errors } } = form;
  const [contractorSearch, setContractorSearch] = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [showContractorDropdown, setShowContractorDropdown] = useState(false);

  const selectedTechIds = watch('assignedTechnicianIds') ?? [];
  const selectedContractorId = watch('contractorCompanyId');
  const isManualContractor = watch('isManualContractor');

  function toggleTechnician(tech: TechnicianOption) {
    const ids: string[] = watch('assignedTechnicianIds') ?? [];
    const names: string[] = watch('assignedTechnicianNames') ?? [];
    if (ids.includes(tech.id)) {
      setValue('assignedTechnicianIds', ids.filter((i: string) => i !== tech.id));
      setValue('assignedTechnicianNames', names.filter((n: string) => n !== tech.name));
    } else {
      setValue('assignedTechnicianIds', [...ids, tech.id]);
      setValue('assignedTechnicianNames', [...names, tech.name]);
    }
  }

  function selectContractor(c: ContractorOption) {
    setValue('contractorCompanyId', c.id);
    setValue('contractorCompanyName', c.companyName);
    setValue('contractorContactPerson', c.contactPerson);
    setValue('contractorContactNumber', c.contactNumber);
    setValue('isManualContractor', false);
    setShowContractorDropdown(false);
    setContractorSearch(c.companyName);
  }

  function handleContractorInput(val: string) {
    setContractorSearch(val);
    setValue('contractorCompanyName', val);
    setValue('contractorCompanyId', null);
    setValue('isManualContractor', true);
    setShowContractorDropdown(true);
  }

  const filteredContractors = contractors.filter(
    (c) => c.isActive && c.companyName.toLowerCase().includes(contractorSearch.toLowerCase()),
  );

  const filteredTechs = technicians.filter((t) =>
    t.name.toLowerCase().includes(techSearch.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Always visible: Supervisor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {WO_COPY.supervisorLabel} <span className="text-red-500">*</span>
        </label>
        <input
          {...register('supervisorInChargeId')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={WO_COPY.supervisorPlaceholder}
        />
        {errors.supervisorInChargeId && (
          <p className="mt-1 text-xs text-red-500">{String(errors.supervisorInChargeId.message ?? '')}</p>
        )}
      </div>

      {/* Estimated Duration */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {WO_COPY.estimatedDurationLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={0.5}
            step={0.5}
            {...register('estimatedDuration', { valueAsNumber: true })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
          {errors.estimatedDuration && (
            <p className="mt-1 text-xs text-red-500">{String(errors.estimatedDuration.message ?? '')}</p>
          )}
        </div>
        <div className="w-28">
          <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
          <select
            {...register('estimatedDurationUnit')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      </div>

      {/* Scheduled Start */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {WO_COPY.scheduledStartLabel}
        </label>
        <input
          type="datetime-local"
          {...register('scheduledStart', { valueAsDate: true })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Dynamic: Internal team OR Contractor */}
      {!isContractorWO ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {WO_COPY.techniciansLabel}
          </label>
          <input
            type="text"
            value={techSearch}
            onChange={(e) => setTechSearch(e.target.value)}
            placeholder={WO_COPY.techniciansPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 mb-2"
          />
          <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-gray-100">
            {filteredTechs.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-2">No technicians found</p>
            ) : (
              filteredTechs.map((tech) => {
                const isSelected = selectedTechIds.includes(tech.id);
                return (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() => toggleTechnician(tech)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </span>
                      <span className="font-medium">{tech.name}</span>
                      <span className="text-gray-400">{tech.department}</span>
                    </span>
                    <span className="text-xs text-gray-500">{tech.activeWOCount} active WOs</span>
                  </button>
                );
              })
            )}
          </div>
          {selectedTechIds.length > 0 && (
            <p className="mt-1 text-xs text-blue-600">{selectedTechIds.length} technician(s) selected</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Contractor Company */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {WO_COPY.contractorCompanyLabel} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={contractorSearch}
              onChange={(e) => handleContractorInput(e.target.value)}
              onFocus={() => setShowContractorDropdown(true)}
              onBlur={() => setTimeout(() => setShowContractorDropdown(false), 200)}
              placeholder={WO_COPY.contractorPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
            {isManualContractor && contractorSearch && (
              <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <span>⚠️</span>
                <span>{WO_COPY.unregisteredContractorWarning}</span>
              </div>
            )}
            {showContractorDropdown && filteredContractors.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                {filteredContractors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={() => selectContractor(c)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0 ${
                      selectedContractorId === c.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{c.companyName}</span>
                      <span className="text-xs text-amber-500">★ {c.rating.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.specializations.slice(0, 3).map((s) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                    {c.lastJobDate && (
                      <p className="text-xs text-gray-400 mt-0.5">Last job: {c.lastJobDate}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contact Person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {WO_COPY.contractorContactLabel} <span className="text-red-500">*</span>
            </label>
            <input
              {...register('contractorContactPerson')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Contact Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {WO_COPY.contractorPhoneLabel} <span className="text-red-500">*</span>
            </label>
            <input
              {...register('contractorContactNumber')}
              type="tel"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* On-site Technician Names */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {WO_COPY.contractorTechsLabel}
            </label>
            <textarea
              rows={3}
              placeholder={WO_COPY.contractorTechsHint}
              onChange={(e) => {
                const names = e.target.value
                  .split('\n')
                  .map((n) => n.trim())
                  .filter(Boolean);
                setValue('contractorTechnicianNames', names);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="mt-0.5 text-xs text-gray-400">{WO_COPY.contractorTechsHint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
