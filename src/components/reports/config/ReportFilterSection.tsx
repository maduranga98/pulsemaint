import CheckboxGroup from './CheckboxGroup';
import ContractorMultiSelect from './ContractorMultiSelect';
import DepartmentMultiSelect from './DepartmentMultiSelect';
import MachineMultiSelect from './MachineMultiSelect';
import MultiValueInput from './MultiValueInput';
import SeverityCheckboxGroup from './SeverityCheckboxGroup';
import ShiftCheckboxGroup from './ShiftCheckboxGroup';
import TechnicianMultiSelect from './TechnicianMultiSelect';
import type { ReportConfig, ReportDefinition } from '../../../types/reports.types';

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
      {has('breakdown_type') && <MultiValueInput label="Breakdown Type" placeholder="Mechanical, Electrical" values={config.breakdownTypes} onChange={(breakdownTypes) => onChange({ breakdownTypes })} />}
      {has('technician') && <TechnicianMultiSelect values={config.technicians} onChange={(technicians) => onChange({ technicians })} />}
      {has('contractor') && <ContractorMultiSelect values={config.contractors} onChange={(contractors) => onChange({ contractors })} />}
      {has('part_category') && <MultiValueInput label="Part Category" placeholder="Bearings, Belts" values={config.partCategories} onChange={(partCategories) => onChange({ partCategories })} />}
      {has('shift') && <ShiftCheckboxGroup values={config.shifts} onChange={(shifts) => onChange({ shifts })} />}
      {has('supervisor') && <MultiValueInput label="Supervisor" placeholder="Supervisor names" values={config.supervisors} onChange={(supervisors) => onChange({ supervisors })} />}
      {has('priority') && <CheckboxGroup label="Priority" options={['Critical', 'High', 'Medium', 'Low']} values={config.priorities} onChange={(priorities) => onChange({ priorities })} />}
      {has('invoice_status') && <CheckboxGroup label="Invoice Status" options={['Paid', 'Pending', 'Disputed']} values={config.invoiceStatuses} onChange={(invoiceStatuses) => onChange({ invoiceStatuses })} />}
      {has('training_status') && <CheckboxGroup label="Training Status" options={['Certified', 'Expiring', 'Expired', 'In Progress']} values={config.trainingStatuses} onChange={(trainingStatuses) => onChange({ trainingStatuses })} />}
      {has('sla_status') && <CheckboxGroup label="SLA Status" options={['Within', 'At Risk', 'Breached']} values={config.slaStatuses} onChange={(slaStatuses) => onChange({ slaStatuses })} />}
      {!report.availableFilters.length && <p className="text-sm text-[#8BA3BF]">This report uses date range and access scope only.</p>}
    </section>
  );
}
