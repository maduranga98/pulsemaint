import type { ReactNode } from 'react';
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
      <InfoCard title="Company Information">
        <Field label="Legal name" value={contractor.companyName} />
        <Field label="Trade name" value={contractor.tradeName} />
        <Field label="Registration" value={contractor.registrationNumber} />
        <Field label="Company type" value={contractor.companyType?.replace(/_/g, ' ')} />
        <Field label="Established" value={contractor.dateEstablished} />
        <Field label="Address" value={address} />
        <Field label="Website" value={contractor.website} />
        <Field label="Notes" value={contractor.notes} />
      </InfoCard>

      {hasContactData && (
      <InfoCard title="Contact Details">
        <Field label="Primary contact" value={primaryContact} />
        <Field label="Primary phone" value={contractor.primaryPhone} />
        <Field label="Primary email" value={contractor.primaryEmail} />
        <Field label="Secondary contact" value={contractor.secondaryContactName} />
        <Field label="Secondary phone" value={contractor.secondaryPhone} />
        <Field label="Emergency" value={contractor.emergencyContact} />
        <Field label="WhatsApp" value={contractor.whatsappNumber} />
      </InfoCard>
      )}

      {hasServiceData && (
      <InfoCard title="Service Capabilities">
        {specializations.length > 0 && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Specializations</dt>
            <dd className="mt-2"><ContractorSpecializationTags tags={specializations} /></dd>
          </div>
        )}
        <Field label="Machine types" value={(contractor.machineTypesServiced ?? []).join(', ')} />
        <Field label="Industries" value={(contractor.industriesServed ?? []).join(', ')} />
        <Field label="Coverage" value={coverage} />
        <Field label="Service hours" value={contractor.serviceHours?.replace(/_/g, ' ')} />
        <Field label="Response time" value={contractor.emergencyResponseTime} />
        <Field label="Team size" value={contractor.teamSizeAvailable ? contractor.teamSizeAvailable : null} />
        <Field label="Languages" value={languages} />
      </InfoCard>
      )}

      {access.canViewFinancials && hasFinancialData && (
        <InfoCard title="Financial Details">
          <Field label="Payment methods" value={paymentMethods} />
          <Field
            label="Bank"
            value={
              contractor.bankName
                ? `${contractor.bankName}${contractor.bankBranch ? ` (${contractor.bankBranch})` : ''}`
                : null
            }
          />
          <Field
            label="Account"
            value={
              contractor.bankAccountNumber
                ? `${contractor.bankAccountName ? `${contractor.bankAccountName} · ` : ''}****${contractor.bankAccountNumber.slice(-4)}`
                : null
            }
          />
          <Field label="Tax registration" value={contractor.taxRegistrationNumber} />
        </InfoCard>
      )}

      {access.canViewFinancials && projects.length > 0 && (
        <InfoCard title="Previously Completed Projects">
          {projects.map((project, index) => (
            <div key={index} className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{project.name || 'Untitled project'}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {hasValue(project.cost) && <span>Cost: {project.cost}</span>}
                {hasValue(project.rating) && <span>Rating: {project.rating} ★</span>}
                {hasValue(project.duration) && <span>Duration: {project.duration}</span>}
                {hasValue(project.contractType) && <span>Type: {project.contractType}</span>}
              </div>
              {hasValue(project.forbiddenActions) && (
                <p className="mt-1 text-xs text-red-600">Violations: {project.forbiddenActions}</p>
              )}
            </div>
          ))}
        </InfoCard>
      )}

      {hasPerformanceData && (
        <InfoCard title="Performance Summary">
          <Field label="Average rating" value={`${(contractor.avgRating ?? 0).toFixed(1)}/5 (${contractor.ratingCount ?? 0} ratings)`} />
          <Field label="Total jobs" value={`${contractor.totalJobsCount ?? 0} (Breakdown ${contractor.breakdownJobsCount ?? 0} | PM ${contractor.pmJobsCount ?? 0} | Install ${contractor.installationJobsCount ?? 0})`} />
          <Field label="Average MTTR" value={(contractor.avgMttr ?? 0) > 0 ? `${contractor.avgMttr} min` : null} />
          <Field label="SLA compliance" value={(contractor.slaComplianceRate ?? 0) > 0 ? `${contractor.slaComplianceRate}%` : null} />
          <Field label="Avg job cost" value={(contractor.avgJobCost ?? 0) > 0 ? formatLkr(contractor.avgJobCost) : null} />
        </InfoCard>
      )}
    </div>
  );
}

export default ContractorOverviewTab;
