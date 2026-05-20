import type { Contractor, ContractorDocument } from '@/lib/contractors/contractorTypes';
import { CONTRACTOR_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/lib/contractors/contractorTypes';

interface ComplianceMatrixProps {
  contractors: Contractor[];
  documents: ContractorDocument[];
}

function statusFor(contractorId: string, documentType: ContractorDocument['documentType'], documents: ContractorDocument[]) {
  const document = documents.find((item) => item.contractorId === contractorId && item.documentType === documentType && !item.supersededBy);
  if (!document) return { label: 'Not uploaded', className: 'bg-slate-100 text-slate-500' };
  if (document.validityStatus === 'expired') return { label: 'Expired', className: 'bg-red-50 text-red-700' };
  if (document.validityStatus === 'expiring_soon') return { label: 'Expiring', className: 'bg-amber-50 text-amber-700' };
  return { label: document.isPermanent ? 'No Expiry' : 'Valid', className: 'bg-emerald-50 text-emerald-700' };
}

export function ComplianceMatrix({ contractors, documents }: ComplianceMatrixProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[1200px] text-xs">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="sticky left-0 bg-slate-50 px-3 py-3">Contractor</th>
            {CONTRACTOR_DOCUMENT_TYPES.map((type) => <th key={type} className="px-3 py-3">{DOCUMENT_TYPE_LABELS[type]}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contractors.map((contractor) => (
            <tr key={contractor.id}>
              <td className="sticky left-0 bg-white px-3 py-3 font-semibold text-slate-900">{contractor.companyName}</td>
              {CONTRACTOR_DOCUMENT_TYPES.map((type) => {
                const status = statusFor(contractor.id, type, documents);
                return <td key={type} className="px-3 py-3"><span className={`rounded-full px-2 py-1 font-medium ${status.className}`}>{status.label}</span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ComplianceMatrix;
