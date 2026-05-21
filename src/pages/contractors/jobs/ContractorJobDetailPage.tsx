import { Link, useParams } from 'react-router-dom';
import { useContractorInvitations } from '@/hooks/contractors/useContractorInvitations';
import { useContractorJob } from '@/hooks/contractors/useContractorJob';
import ArrivalLogSection from '@/components/contractors/jobs/ArrivalLogSection';
import ContractorJobHeader from '@/components/contractors/jobs/ContractorJobHeader';
import ContractorJobStatusStepper from '@/components/contractors/jobs/ContractorJobStatusStepper';
import JobInvitationSection from '@/components/contractors/jobs/JobInvitationSection';
import PartsUsedSection from '@/components/contractors/jobs/PartsUsedSection';
import PhotosSection from '@/components/contractors/jobs/PhotosSection';
import PostJobChecklistSection from '@/components/contractors/jobs/PostJobChecklistSection';
import WorkLogEntryForm from '@/components/contractors/jobs/WorkLogEntryForm';
import WorkLogTimeline from '@/components/contractors/jobs/WorkLogTimeline';

export function ContractorJobDetailPage() {
  const { jobId } = useParams();
  const { job, loading } = useContractorJob(jobId);
  const { invitations } = useContractorInvitations(jobId);

  if (loading) return <div className="p-6 text-slate-500">Loading job...</div>;
  if (!job) return <div className="p-6 text-slate-500">Contractor job not found.</div>;

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <ContractorJobHeader job={job} />
      <ContractorJobStatusStepper status={job.status} />
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Contractor Team</h2>
        <p className="mt-2 text-sm text-slate-700">{job.contactPerson} - <a href={`tel:${job.contactPhone}`} className="font-semibold text-blue-700">{job.contactPhone}</a></p>
        <p className="text-sm text-slate-500">{job.technicianNames.join(', ') || 'Technicians not confirmed'}</p>
      </section>
      <ArrivalLogSection job={job} />
      <JobInvitationSection job={job} invitations={invitations} />
      <WorkLogEntryForm />
      <WorkLogTimeline steps={job.workSteps} />
      <PartsUsedSection job={job} />
      <PostJobChecklistSection job={job} />
      <PhotosSection job={job} />
      <div className="flex flex-wrap gap-2">
        <Link to={`/app/contractors/jobs/${job.id}/log-work`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Log Work</Link>
        <Link to={`/app/contractors/jobs/${job.id}/sign-off`} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Sign-Off</Link>
        <Link to={`/app/contractors/jobs/${job.id}/invoice`} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Invoice</Link>
        <Link to={`/app/contractors/jobs/${job.id}/rate`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Rate</Link>
      </div>
    </div>
  );
}

export default ContractorJobDetailPage;
