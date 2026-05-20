import { useFormContext } from 'react-hook-form';
import type { CreatePMFormValues } from '../../../schemas/pm';
import type { Machine } from '../../../types/machine';

interface Step2MachineSelectProps {
  machines: Machine[];
}

export function Step2MachineSelect({ machines }: Step2MachineSelectProps) {
  const { register, setValue, watch, formState: { errors } } = useFormContext<CreatePMFormValues>();
  const selectedMachineId = watch('machineId');

  const selectedMachine = machines.find((m) => m.id === selectedMachineId);

  const handleSelect = (machine: Machine) => {
    setValue('machineId', machine.id);
    setValue('machineName', machine.name);
    setValue('machineCriticality', machine.criticality);
    setValue('department', machine.department);
    setValue('location', [machine.floor, machine.bay, machine.station].filter(Boolean).join(' / ') || machine.department);

    // Auto-upgrade priority if machine criticality = 5
    if (machine.criticality === 5) {
      setValue('priority', 'critical');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Machine Selection</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Machine *</label>
        <select
          {...register('machineId')}
          onChange={(e) => {
            const machine = machines.find((m) => m.id === e.target.value);
            if (machine) handleSelect(machine);
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          <option value="">Select a machine...</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.department} (Health: {m.healthScore}%)
            </option>
          ))}
        </select>
        {errors.machineId && <p className="text-xs text-red-500 mt-1">{errors.machineId.message}</p>}
      </div>

      {selectedMachine && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Department</span>
            <span className="font-medium text-gray-900">{selectedMachine.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Location</span>
            <span className="font-medium text-gray-900">
              {[selectedMachine.floor, selectedMachine.bay, selectedMachine.station].filter(Boolean).join(' / ') || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Machine Type</span>
            <span className="font-medium text-gray-900">{selectedMachine.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Criticality</span>
            <span className={`font-medium ${selectedMachine.criticality === 5 ? 'text-red-600' : 'text-gray-900'}`}>
              {selectedMachine.criticality}/5
              {selectedMachine.criticality === 5 && ' (Auto-upgraded PM to Critical)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Health Score</span>
            <span className="font-medium text-gray-900">{selectedMachine.healthScore}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
