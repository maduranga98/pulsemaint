import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import CheckboxGroup from './CheckboxGroup';
import ContractorMultiSelect from './ContractorMultiSelect';
import DepartmentMultiSelect from './DepartmentMultiSelect';
import MachineMultiSelect from './MachineMultiSelect';
import SearchableMultiSelect, { type SelectOption } from './SearchableMultiSelect';
import SeverityCheckboxGroup from './SeverityCheckboxGroup';
import ShiftCheckboxGroup from './ShiftCheckboxGroup';
import SupervisorMultiSelect from './SupervisorMultiSelect';
import TechnicianMultiSelect from './TechnicianMultiSelect';
import type { ReportConfig, ReportDefinition } from '../../../types/reports.types';

// Values match the BreakdownType union stored on breakdown_tickets docs.
function breakdownTypeOptions(t: TFunction): SelectOption[] {
  return [
    { value: 'mechanical', label: t('common.reports.config.enums.breakdownType.mechanical') },
    { value: 'electrical', label: t('common.reports.config.enums.breakdownType.electrical') },
    { value: 'hydraulic', label: t('common.reports.config.enums.breakdownType.hydraulic') },
    { value: 'pneumatic', label: t('common.reports.config.enums.breakdownType.pneumatic') },
    { value: 'software', label: t('common.reports.config.enums.breakdownType.software') },
    { value: 'other', label: t('common.reports.config.enums.breakdownType.other') },
  ];
}

// Values match the WOType union stored (upper-case) on workOrders docs. The
// report filter comparison is case-insensitive, so lower-case values match.
function woTypeOptions(t: TFunction): SelectOption[] {
  return [
    { value: 'breakdown', label: t('common.reports.config.enums.woType.breakdown') },
    { value: 'corrective', label: t('common.reports.config.enums.woType.corrective') },
    { value: 'preventive', label: t('common.reports.config.enums.woType.preventive') },
    { value: 'installation', label: t('common.reports.config.enums.woType.installation') },
    { value: 'modification', label: t('common.reports.config.enums.woType.modification') },
    { value: 'inspection', label: t('common.reports.config.enums.woType.inspection') },
    { value: 'contractor', label: t('common.reports.config.enums.woType.contractor') },
    { value: 'other', label: t('common.reports.config.enums.woType.other') },
  ];
}

// Values match the standard PartCategory options stored on inventoryParts
// docs. Parts may also carry a freeform, manually-created category name.
function partCategoryOptions(t: TFunction): SelectOption[] {
  return [
    { value: 'electrical', label: t('common.reports.config.enums.partCategory.electrical') },
    { value: 'mechanical', label: t('common.reports.config.enums.partCategory.mechanical') },
    { value: 'hydraulic', label: t('common.reports.config.enums.partCategory.hydraulic') },
    { value: 'pneumatic', label: t('common.reports.config.enums.partCategory.pneumatic') },
    { value: 'automation', label: t('common.reports.config.enums.partCategory.automation') },
    { value: 'civil', label: t('common.reports.config.enums.partCategory.civil') },
  ];
}

export default function ReportFilterSection({
  report,
  config,
  onChange,
}: {
  report: ReportDefinition;
  config: ReportConfig;
  onChange: (updates: Partial<ReportConfig>) => void;
}) {
  const { t } = useTranslation();
  const has = (filter: string) => report.availableFilters.includes(filter as never);
  // Priority reuses the same Critical/High/Medium/Low labels as Severity —
  // both are the same fixed 4-level scale, just applied to a different field.
  const priorityOptions = [
    t('common.reports.config.enums.severity.critical'),
    t('common.reports.config.enums.severity.high'),
    t('common.reports.config.enums.severity.medium'),
    t('common.reports.config.enums.severity.low'),
  ];
  const trainingStatusOptions = [
    t('common.reports.config.enums.trainingStatus.certified'),
    t('common.reports.config.enums.trainingStatus.expiring'),
    t('common.reports.config.enums.trainingStatus.expired'),
    t('common.reports.config.enums.trainingStatus.inProgress'),
  ];
  const trainingTypeOptions = [
    t('common.reports.config.enums.trainingType.safetyTraining'),
    t('common.reports.config.enums.trainingType.generalTraining'),
  ];
  const slaStatusOptions = [
    t('common.reports.config.enums.slaStatus.within'),
    t('common.reports.config.enums.slaStatus.atRisk'),
    t('common.reports.config.enums.slaStatus.breached'),
  ];

  return (
    <section className="space-y-3 border-b border-[#1E3A5F] pb-5">
      <h3 className=" text-sm font-semibold text-[#F0F4F8]">{t('common.reports.config.reportFilterSection.title')}</h3>
      {has('machine') && <MachineMultiSelect values={config.machines} onChange={(machines) => onChange({ machines })} />}
      {report.type === 'machine_history' && config.machines.length !== 1 && (
        <p className="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-[#FCD34D]">
          {t('common.reports.config.reportFilterSection.machineHistoryWarning')}
        </p>
      )}
      {has('department') && <DepartmentMultiSelect values={config.departments} onChange={(departments) => onChange({ departments })} />}
      {has('severity') && <SeverityCheckboxGroup values={config.severities} onChange={(severities) => onChange({ severities })} />}
      {has('wo_type') && (
        <SearchableMultiSelect
          label={t('common.reports.config.reportFilterSection.labels.woType')}
          options={woTypeOptions(t)}
          values={config.woTypes}
          onChange={(woTypes) => onChange({ woTypes })}
          placeholder={t('common.reports.config.reportFilterSection.placeholders.woType')}
        />
      )}
      {has('breakdown_type') && (
        <SearchableMultiSelect
          label={t('common.reports.config.reportFilterSection.labels.breakdownType')}
          options={breakdownTypeOptions(t)}
          values={config.breakdownTypes}
          onChange={(breakdownTypes) => onChange({ breakdownTypes })}
          placeholder={t('common.reports.config.reportFilterSection.placeholders.breakdownType')}
        />
      )}
      {has('technician') && <TechnicianMultiSelect values={config.technicians} onChange={(technicians) => onChange({ technicians })} />}
      {has('contractor') && <ContractorMultiSelect values={config.contractors} onChange={(contractors) => onChange({ contractors })} />}
      {has('part_category') && (
        <SearchableMultiSelect
          label={t('common.reports.config.reportFilterSection.labels.partCategory')}
          options={partCategoryOptions(t)}
          values={config.partCategories}
          onChange={(partCategories) => onChange({ partCategories })}
          placeholder={t('common.reports.config.reportFilterSection.placeholders.partCategory')}
        />
      )}
      {has('shift') && <ShiftCheckboxGroup values={config.shifts} onChange={(shifts) => onChange({ shifts })} />}
      {has('supervisor') && <SupervisorMultiSelect values={config.supervisors} onChange={(supervisors) => onChange({ supervisors })} />}
      {has('priority') && <CheckboxGroup label={t('common.reports.config.reportFilterSection.labels.priority')} options={priorityOptions} values={config.priorities} onChange={(priorities) => onChange({ priorities })} />}
      {has('training_status') && <CheckboxGroup label={t('common.reports.config.reportFilterSection.labels.trainingStatus')} options={trainingStatusOptions} values={config.trainingStatuses} onChange={(trainingStatuses) => onChange({ trainingStatuses })} />}
      {has('training_type') && <CheckboxGroup label={t('common.reports.config.reportFilterSection.labels.trainingType')} options={trainingTypeOptions} values={config.trainingTypes} onChange={(trainingTypes) => onChange({ trainingTypes })} />}
      {has('sla_status') && <CheckboxGroup label={t('common.reports.config.reportFilterSection.labels.slaStatus')} options={slaStatusOptions} values={config.slaStatuses} onChange={(slaStatuses) => onChange({ slaStatuses })} />}
      {!report.availableFilters.length && <p className="text-sm text-[#8BA3BF]">{t('common.reports.config.reportFilterSection.noFilters')}</p>}
    </section>
  );
}
