import CheckboxGroup from './CheckboxGroup';
import ContractorMultiSelect from './ContractorMultiSelect';
import DepartmentMultiSelect from './DepartmentMultiSelect';
import MachineMultiSelect from './MachineMultiSelect';
import MultiValueInput from './MultiValueInput';
import SearchableMultiSelect, { type SelectOption } from './SearchableMultiSelect';
import SeverityCheckboxGroup from './SeverityCheckboxGroup';
import ShiftCheckboxGroup from './ShiftCheckboxGroup';
import SupervisorMultiSelect from './SupervisorMultiSelect';
import TechnicianMultiSelect from './TechnicianMultiSelect';
import type { ReportConfig, ReportDefinition } from '../../../types/reports.types';

// Values match the BreakdownType union stored on breakdown_tickets docs.
const BREAKDOWN_TYPE_OPTIONS: SelectOption[] = [
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'pneumatic', label: 'Pneumatic' },
  { value: 'software', label: 'Software' },
  { value: 'other', label: 'Other' },
];

// Values match the standard PartCategory options stored on inventoryParts
// docs. Parts may also carry a freeform, manually-created category name.
const PART_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'pneumatic', label: 'Pneumatic' },
  { value: 'automation', label: 'Automation' },
  { value: 'civil', label: 'Civil' },
];

export default function ReportFilterSection({
  report,
  config,
  onChange,
}: {
  report: ReportDefinition;
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}) {
  const has = (filter: string) => report.availableFilters.includes(filter as never);

  return (
    <section className="space-y-3 border-b border-[#1E3A5F] pb-5">
      <h3 className="font-[Sora] text-sm font-semibold text-[#F0F4F8]">Report Filters</h3>
      {has('machine') && <MachineMultiSelect values={config.machines} onChange={(machines) => onChange({ machines })} />}
      {report.type === 'machine_history' && config.machines.length !== 1 && (
        <p className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-[#FCD34D]">
          Machine History requires exactly one machine.
        </p>
      )}
      {has('department') && <DepartmentMultiSelect values={config.departments} onChange={(departments) => onChange({ departments })} />}
      {has('severity') && <SeverityCheckboxGroup values={config.severities} onChange={(severities) => onChange({ severities })} />}
      {has('wo_type') && <MultiValueInput label="WO Type" placeholder="Breakdown, PM, Corrective" values={config.woTypes} onChange={(woTypes) => onChange({ woTypes })} />}
      {has('breakdown_type') && (
        <SearchableMultiSelect
          label="Breakdown Type"
          options={BREAKDOWN_TYPE_OPTIONS}
          values={config.breakdownTypes}
          onChange={(breakdownTypes) => onChange({ breakdownTypes })}
          placeholder="Search breakdown types…"
        />
      )}
      {has('technician') && <TechnicianMultiSelect values={config.technicians} onChange={(technicians) => onChange({ technicians })} />}
      {has('contractor') && <ContractorMultiSelect values={config.contractors} onChange={(contractors) => onChange({ contractors })} />}
      {has('part_category') && (
        <SearchableMultiSelect
          label="Part Category"
          options={PART_CATEGORY_OPTIONS}
          values={config.partCategories}
          onChange={(partCategories) => onChange({ partCategories })}
          placeholder="Search part categories…"
        />
      )}
      {has('shift') && <ShiftCheckboxGroup values={config.shifts} onChange={(shifts) => onChange({ shifts })} />}
      {has('supervisor') && <SupervisorMultiSelect values={config.supervisors} onChange={(supervisors) => onChange({ supervisors })} />}
      {has('priority') && <CheckboxGroup label="Priority" options={['Critical', 'High', 'Medium', 'Low']} values={config.priorities} onChange={(priorities) => onChange({ priorities })} />}
      {has('training_status') && <CheckboxGroup label="Training Status" options={['Certified', 'Expiring', 'Expired', 'In Progress']} values={config.trainingStatuses} onChange={(trainingStatuses) => onChange({ trainingStatuses })} />}
      {has('sla_status') && <CheckboxGroup label="SLA Status" options={['Within', 'At Risk', 'Breached']} values={config.slaStatuses} onChange={(slaStatuses) => onChange({ slaStatuses })} />}
      {!report.availableFilters.length && <p className="text-sm text-[#8BA3BF]">This report uses date range and access scope only.</p>}
    </section>
  );
}
