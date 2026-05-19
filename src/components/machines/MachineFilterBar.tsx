import { useState, useCallback } from 'react';
import type { MachineFilters, MachineStatus, MachineCriticality } from '../../types/machine';

interface MachineFilterBarProps {
  onFiltersChange: (filters: Partial<MachineFilters>) => void;
  departments?: string[];
  isLoading?: boolean;
}

const statusOptions: { value: MachineStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'decommissioned', label: 'Decommissioned' },
];

const criticalityOptions: { value: MachineCriticality; label: string }[] = [
  { value: 5, label: '5 - Mission Critical' },
  { value: 4, label: '4 - High' },
  { value: 3, label: '3 - Medium' },
  { value: 2, label: '2 - Low' },
  { value: 1, label: '1 - Minimal' },
];

const healthScoreOptions = [
  { min: 70, max: 100, label: 'Good (70-100)' },
  { min: 40, max: 69, label: 'Warning (40-69)' },
  { min: 0, max: 39, label: 'Critical (0-39)' },
];

export function MachineFilterBar({
  onFiltersChange,
  departments = [],
  isLoading = false,
}: MachineFilterBarProps) {
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<MachineStatus[]>([]);
  const [selectedCriticalities, setSelectedCriticalities] = useState<MachineCriticality[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [healthScoreRange, setHealthScoreRange] = useState<[number, number]>([0, 100]);

  const updateFilters = useCallback(() => {
    onFiltersChange({
      search,
      statuses: selectedStatuses,
      criticalities: selectedCriticalities,
      departments: selectedDepartments,
      healthScoreRange,
    });
  }, [search, selectedStatuses, selectedCriticalities, selectedDepartments, healthScoreRange, onFiltersChange]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const handleStatusToggle = (status: MachineStatus) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    setSelectedStatuses(newStatuses);
    onFiltersChange({
      statuses: newStatuses,
    });
  };

  const handleCriticalityToggle = (criticality: MachineCriticality) => {
    const newCriticalities = selectedCriticalities.includes(criticality)
      ? selectedCriticalities.filter((c) => c !== criticality)
      : [...selectedCriticalities, criticality];
    setSelectedCriticalities(newCriticalities);
    onFiltersChange({
      criticalities: newCriticalities,
    });
  };

  const handleDepartmentToggle = (dept: string) => {
    const newDepts = selectedDepartments.includes(dept)
      ? selectedDepartments.filter((d) => d !== dept)
      : [...selectedDepartments, dept];
    setSelectedDepartments(newDepts);
    onFiltersChange({
      departments: newDepts,
    });
  };

  const handleHealthScoreChange = (range: 'good' | 'warning' | 'critical') => {
    const rangeMap = {
      good: [70, 100] as [number, number],
      warning: [40, 69] as [number, number],
      critical: [0, 39] as [number, number],
    };
    setHealthScoreRange(rangeMap[range]);
    onFiltersChange({
      healthScoreRange: rangeMap[range],
    });
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedStatuses([]);
    setSelectedCriticalities([]);
    setSelectedDepartments([]);
    setHealthScoreRange([0, 100]);
    onFiltersChange({
      search: '',
      statuses: [],
      criticalities: [],
      departments: [],
      healthScoreRange: [0, 100],
    });
  };

  const hasActiveFilters =
    search ||
    selectedStatuses.length > 0 ||
    selectedCriticalities.length > 0 ||
    selectedDepartments.length > 0 ||
    healthScoreRange[0] > 0 ||
    healthScoreRange[1] < 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Search input */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name, model, or serial number..."
            value={search}
            onChange={(e) => {
              handleSearchChange(e.target.value);
              updateFilters();
            }}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Status</label>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusToggle(option.value)}
              disabled={isLoading}
              className={`px-3 py-1 text-sm rounded-full border transition-colors disabled:opacity-50 ${
                selectedStatuses.includes(option.value)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Criticality filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Criticality</label>
        <div className="flex flex-wrap gap-2">
          {criticalityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleCriticalityToggle(option.value)}
              disabled={isLoading}
              className={`px-3 py-1 text-sm rounded-full border transition-colors disabled:opacity-50 ${
                selectedCriticalities.includes(option.value)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Department filter */}
      {departments.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Department</label>
          <div className="flex flex-wrap gap-2">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => handleDepartmentToggle(dept)}
                disabled={isLoading}
                className={`px-3 py-1 text-sm rounded-full border transition-colors disabled:opacity-50 ${
                  selectedDepartments.includes(dept)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Health Score filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Health Score</label>
        <div className="flex flex-wrap gap-2">
          {healthScoreOptions.map((option) => (
            <button
              key={`${option.min}-${option.max}`}
              onClick={() => handleHealthScoreChange(option.min === 70 ? 'good' : option.min === 40 ? 'warning' : 'critical')}
              disabled={isLoading}
              className={`px-3 py-1 text-sm rounded-full border transition-colors disabled:opacity-50 ${
                healthScoreRange[0] === option.min && healthScoreRange[1] === option.max
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
