import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Contractor } from '@/lib/contractors/contractorTypes';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';
import ContractorSpecializationTags from './ContractorSpecializationTags';

interface ContractorOverviewTabProps {
  contractor: Contractor;
}

function hasValue(value?: string | number | null): boolean {
  if (value == null) return false;
  if (typeof value === 'number') return true;
  return value.trim().length > 0;
}

/** Renders a labelled field, but only when it actually carries a value so the
 * profile shows the details that were entered — not a wall of empty "-" rows. */
function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!hasValue(value)) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <dl className="mt-4 grid gap-3">{children}</dl>
    </section>
  );
}

export function ContractorOverviewTab({ contractor }: ContractorOverviewTabProps) {
  const { t } = useTranslation();
  const access = useContractorAccess();

  const primaryContact = `${contractor.primaryContactName ?? ''} ${
    contractor.primaryContactDesig ? `- ${contractor.primaryContactDesig}` : ''
  }`.trim();
  const address = [contractor.primaryAddress, contractor.city].filter(Boolean).join(', ');
  const specializations = contractor.specializationTags ?? [];
  const coverage = (contractor.geographicCoverage ?? []).join(', ');
  const languages = (contractor.languagesSpoken ?? []).join(', ');
  const paymentMethods = (contractor.paymentMethods ?? []).join(', ');
  const projects = (contractor.previouslyCompletedProjects ?? []).filter((p) => hasValue(p.name) || hasValue(p.cost));
  const hasFinancialData =
    hasValue(paymentMethods) ||
    hasValue(contractor.bankName) ||
    hasValue(contractor.bankAccountNumber) ||
    hasValue(contractor.taxRegistrationNumber);
  const hasPerformanceData = (contractor.totalJobsCount ?? 0) > 0 || (contractor.ratingCount ?? 0) > 0;
  const hasContactData =
    hasValue(primaryContact) ||
    hasValue(contractor.primaryPhone) ||
    hasValue(contractor.primaryEmail) ||
    hasValue(contractor.secondaryContactName) ||
    hasValue(contractor.emergencyContact) ||
    hasValue(contractor.whatsappNumber);
  const hasServiceData =
    specializations.length > 0 ||
    (contractor.machineTypesServiced ?? []).length > 0 ||
    (contractor.industriesServed ?? []).length > 0 ||
    hasValue(coverage) ||
    hasValue(contractor.serviceHours) ||
    hasValue(contractor.emergencyResponseTime) ||
    Boolean(contractor.teamSizeAvailable) ||
    hasValue(languages);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <InfoCard title={t('common.contractors.registry.overviewTab.companyInformation.title')}>
        <Field label={t('common.contractors.registry.overviewTab.companyInformation.legalName')} value={contractor.companyName} />
        <Field label={t('common.contractors.registry.overviewTab.companyInformation.tradeName')} value={contractor.tradeName} />
        <Field label={t('common.contractors.registry.overviewTab.companyInformation.registration')} value={contractor.registrationNumber} />
        <Field label={t('common.contractors.registry.overviewTab.companyInformation.companyType')} value={contractor.companyType?.replace(/_/g, ' ')} />
        <Field label={t('common.contractors.registry.overviewTab.companyInformation.established')} value={contractor.dateEstablished} />
        <Field label={t('common.contractors.registry.overviewTab.companyInformation.address')} value={address} />
        <Field label={t('common.contractors.registry.overviewTab.companyInformation.website')} value={contractor.website} />
        <Field label={t('common.contractors.registry.overviewTab.companyInformation.notes')} value={contractor.notes} />
      </InfoCard>

      {hasContactData && (
      <InfoCard title={t('common.contractors.registry.overviewTab.contactDetails.title')}>
        <Field label={t('common.contractors.registry.overviewTab.contactDetails.primaryContact')} value={primaryContact} />
        <Field label={t('common.contractors.registry.overviewTab.contactDetails.primaryPhone')} value={contractor.primaryPhone} />
        <Field label={t('common.contractors.registry.overviewTab.contactDetails.primaryEmail')} value={contractor.primaryEmail} />
        <Field label={t('common.contractors.registry.overviewTab.contactDetails.secondaryContact')} value={contractor.secondaryContactName} />
        <Field label={t('common.contractors.registry.overviewTab.contactDetails.secondaryPhone')} value={contractor.secondaryPhone} />
        <Field label={t('common.contractors.registry.overviewTab.contactDetails.emergency')} value={contractor.emergencyContact} />
        <Field label={t('common.contractors.registry.overviewTab.contactDetails.whatsapp')} value={contractor.whatsappNumber} />
      </InfoCard>
      )}

      {hasServiceData && (
      <InfoCard title={t('common.contractors.registry.overviewTab.serviceCapabilities.title')}>
        {specializations.length > 0 && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('common.contractors.registry.overviewTab.serviceCapabilities.specializations')}</dt>
            <dd className="mt-2"><ContractorSpecializationTags tags={specializations} /></dd>
          </div>
        )}
        <Field label={t('common.contractors.registry.overviewTab.serviceCapabilities.machineTypes')} value={(contractor.machineTypesServiced ?? []).join(', ')} />
        <Field label={t('common.contractors.registry.overviewTab.serviceCapabilities.industries')} value={(contractor.industriesServed ?? []).join(', ')} />
        <Field label={t('common.contractors.registry.overviewTab.serviceCapabilities.coverage')} value={coverage} />
        <Field label={t('common.contractors.registry.overviewTab.serviceCapabilities.serviceHours')} value={contractor.serviceHours?.replace(/_/g, ' ')} />
        <Field label={t('common.contractors.registry.overviewTab.serviceCapabilities.responseTime')} value={contractor.emergencyResponseTime} />
        <Field label={t('common.contractors.registry.overviewTab.serviceCapabilities.teamSize')} value={contractor.teamSizeAvailable ? contractor.teamSizeAvailable : null} />
        <Field label={t('common.contractors.registry.overviewTab.serviceCapabilities.languages')} value={languages} />
      </InfoCard>
      )}

      {access.canViewFinancials && hasFinancialData && (
        <InfoCard title={t('common.contractors.registry.overviewTab.financialDetails.title')}>
          <Field label={t('common.contractors.registry.overviewTab.financialDetails.paymentMethods')} value={paymentMethods} />
          <Field
            label={t('common.contractors.registry.overviewTab.financialDetails.bank')}
            value={
              contractor.bankName
                ? `${contractor.bankName}${contractor.bankBranch ? ` (${contractor.bankBranch})` : ''}`
                : null
            }
          />
          <Field
            label={t('common.contractors.registry.overviewTab.financialDetails.account')}
            value={
              contractor.bankAccountNumber
                ? `${contractor.bankAccountName ? `${contractor.bankAccountName} · ` : ''}****${contractor.bankAccountNumber.slice(-4)}`
                : null
            }
          />
          <Field label={t('common.contractors.registry.overviewTab.financialDetails.taxRegistration')} value={contractor.taxRegistrationNumber} />
        </InfoCard>
      )}

      {access.canViewFinancials && projects.length > 0 && (
        <InfoCard title={t('common.contractors.registry.overviewTab.completedProjects.title')}>
          {projects.map((project, index) => (
            <div key={index} className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{project.name || t('common.contractors.registry.overviewTab.completedProjects.untitledProject')}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {hasValue(project.cost) && <span>{t('common.contractors.registry.overviewTab.completedProjects.cost', { cost: project.cost })}</span>}
                {hasValue(project.rating) && <span>{t('common.contractors.registry.overviewTab.completedProjects.rating', { rating: project.rating })}</span>}
                {hasValue(project.duration) && <span>{t('common.contractors.registry.overviewTab.completedProjects.duration', { duration: project.duration })}</span>}
                {hasValue(project.contractType) && <span>{t('common.contractors.registry.overviewTab.completedProjects.type', { type: project.contractType })}</span>}
              </div>
              {hasValue(project.forbiddenActions) && (
                <p className="mt-1 text-xs text-red-600">{t('common.contractors.registry.overviewTab.completedProjects.violations', { violations: project.forbiddenActions })}</p>
              )}
            </div>
          ))}
        </InfoCard>
      )}

      {hasPerformanceData && (
        <InfoCard title={t('common.contractors.registry.overviewTab.performanceSummary.title')}>
          <Field label={t('common.contractors.registry.overviewTab.performanceSummary.averageRating')} value={t('common.contractors.registry.overviewTab.performanceSummary.averageRatingValue', { rating: (contractor.avgRating ?? 0).toFixed(1), count: contractor.ratingCount ?? 0 })} />
          <Field label={t('common.contractors.registry.overviewTab.performanceSummary.totalJobs')} value={t('common.contractors.registry.overviewTab.performanceSummary.totalJobsValue', { total: contractor.totalJobsCount ?? 0, breakdown: contractor.breakdownJobsCount ?? 0, pm: contractor.pmJobsCount ?? 0, install: contractor.installationJobsCount ?? 0 })} />
          <Field label={t('common.contractors.registry.overviewTab.performanceSummary.averageMttr')} value={(contractor.avgMttr ?? 0) > 0 ? t('common.contractors.registry.overviewTab.performanceSummary.minutesValue', { minutes: contractor.avgMttr }) : null} />
          <Field label={t('common.contractors.registry.overviewTab.performanceSummary.slaCompliance')} value={(contractor.slaComplianceRate ?? 0) > 0 ? `${contractor.slaComplianceRate}%` : null} />
          <Field label={t('common.contractors.registry.overviewTab.performanceSummary.avgJobCost')} value={(contractor.avgJobCost ?? 0) > 0 ? formatLkr(contractor.avgJobCost) : null} />
        </InfoCard>
      )}
    </div>
  );
}

export default ContractorOverviewTab;
