import type { ReactNode } from 'react';
import type { Contractor } from '@/lib/contractors/contractorTypes';
import { formatLkr } from '@/lib/contractors/invoiceCalculator';
import { useContractorAccess } from '@/hooks/contractors/useContractorAccess';
import ContractorSpecializationTags from './ContractorSpecializationTags';

interface ContractorOverviewTabProps {
  contractor: Contractor;
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value || '-'}</dd>
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

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <InfoCard title="Company Information">
        <Field label="Legal name" value={contractor.companyName} />
        <Field label="Trade name" value={contractor.tradeName} />
        <Field label="Registration" value={contractor.registrationNumber} />
        <Field label="Company type" value={contractor.companyType?.replace(/_/g, ' ')} />
        <Field label="Established" value={contractor.dateEstablished} />
        <Field label="Address" value={[contractor.primaryAddress, contractor.city].filter(Boolean).join(', ')} />
        <Field label="Website" value={contractor.website} />
        <Field label="Notes" value={contractor.notes} />
      </InfoCard>
      <InfoCard title="Contact Details">
        <Field label="Primary contact" value={`${contractor.primaryContactName ?? ''} ${contractor.primaryContactDesig ? `- ${contractor.primaryContactDesig}` : ''}`.trim()} />
        <Field label="Primary phone" value={contractor.primaryPhone} />
        <Field label="Primary email" value={contractor.primaryEmail} />
        <Field label="Emergency" value={contractor.emergencyContact} />
        <Field label="WhatsApp" value={contractor.whatsappNumber} />
        <Field label="Preferred method" value={contractor.preferredContactMethod} />
      </InfoCard>
      <InfoCard title="Service Capabilities">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Specializations</dt>
          <dd className="mt-2"><ContractorSpecializationTags tags={contractor.specializationTags ?? []} /></dd>
        </div>
        <Field label="Coverage" value={(contractor.geographicCoverage ?? []).join(', ')} />
        <Field label="Service hours" value={contractor.serviceHours?.replace(/_/g, ' ')} />
        <Field label="Response time" value={contractor.emergencyResponseTime} />
        <Field label="Team size" value={contractor.teamSizeAvailable} />
        <Field label="Languages" value={(contractor.languagesSpoken ?? []).join(', ')} />
      </InfoCard>
      {access.canViewFinancials && (
        <InfoCard title="Financial Details">
          <Field label="Payment terms" value={contractor.paymentTerms?.replace(/_/g, ' ')} />
          <Field label="Currency" value={contractor.currency} />
          <Field label="Standard labor" value={`${formatLkr(contractor.standardLaborRate ?? 0)}/hour`} />
          <Field label="Overtime" value={`${formatLkr(contractor.overtimeRate ?? 0)}/hour`} />
          <Field label="Emergency fee" value={formatLkr(contractor.emergencyCallOutFee ?? 0)} />
          <Field label="Minimum charge" value={formatLkr(contractor.minimumCharge ?? 0)} />
          <Field label="Bank" value={contractor.bankName ? `${contractor.bankName} - ****${contractor.bankAccountNumber?.slice(-4) ?? ''}` : '-'} />
          <Field label="Tax registration" value={contractor.taxRegistrationNumber} />
        </InfoCard>
      )}
      <InfoCard title="Performance Summary">
        <Field label="Average rating" value={`${(contractor.avgRating ?? 0).toFixed(1)}/5 (${contractor.ratingCount ?? 0} ratings)`} />
        <Field label="Total jobs" value={`${contractor.totalJobsCount ?? 0} (Breakdown ${contractor.breakdownJobsCount ?? 0} | PM ${contractor.pmJobsCount ?? 0} | Install ${contractor.installationJobsCount ?? 0})`} />
        <Field label="Average MTTR" value={`${contractor.avgMttr ?? 0} min`} />
        <Field label="First-fix rate" value={`${contractor.firstFixRate ?? 0}%`} />
        <Field label="SLA compliance" value={`${contractor.slaComplianceRate ?? 0}%`} />
        <Field label="Avg job cost" value={formatLkr(contractor.avgJobCost ?? 0)} />
        <Field label="Invoice accuracy" value={`${contractor.invoiceAccuracyRate ?? 0}%`} />
      </InfoCard>
    </div>
  );
}

export default ContractorOverviewTab;
