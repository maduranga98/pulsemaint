import { Link } from 'react-router-dom';
import type { ContractorJob } from '@/lib/contractors/contractorTypes';
import ContractorRatingDisplay from '@/components/contractors/registry/ContractorRatingDisplay';
import ContractorJobStatusBadge from './ContractorJobStatusBadge';

interface ContractorJobRowProps {
  job: ContractorJob;
}

export function ContractorJobRow({ job }: ContractorJobRowProps) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3">
        <Link to={`/app/contractors/jobs/${job.id}`} className="font-semibold text-blue-700">{job.workOrderNumber}</Link>
        <p className="text-xs text-slate-500">{job.workOrderType}</p>
      </td>
      <td className="px-4 py-3 text-slate-700">{job.contractorName}</td>
      <td className="px-4 py-3">
        <p className="text-slate-800">{job.machineName}</p>
        <p className="text-xs text-slate-500">{job.machineLocation}</p>
      </td>
      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize text-slate-700">{job.priority}</span></td>
      <td className="px-4 py-3"><ContractorJobStatusBadge status={job.status} /></td>
      <td className="px-4 py-3 text-xs text-slate-600">{job.invitationSentAt ? job.invitationSentAt.toDate().toLocaleString() : '-'}</td>
      <td className="px-4 py-3 text-xs text-slate-600">{job.onSiteDurationMinutes ? `${job.onSiteDurationMinutes} min` : '-'}</td>
      <td className="px-4 py-3">{job.rating ? <ContractorRatingDisplay rating={job.rating.overallScore} compact /> : '-'}</td>
      <td className="px-4 py-3 text-xs capitalize text-slate-600">{job.invoiceStatus ?? 'pending'}</td>
      <td className="px-4 py-3"><Link to={`/app/contractors/jobs/${job.id}`} className="text-xs font-semibold text-blue-700">View</Link></td>
    </tr>
  );
}

export default ContractorJobRow;
