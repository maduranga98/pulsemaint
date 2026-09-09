import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { Contractor, ContractorJob } from '@/lib/contractors/contractorTypes';

interface ContractorAnalyticsTabProps {
  contractor: Contractor;
  jobs: ContractorJob[];
}

export function ContractorAnalyticsTab({ jobs }: ContractorAnalyticsTabProps) {
  const { t } = useTranslation();
  // Total cost captured at sign-off — the same figure the Job History tab uses.
  // systemInvoiceAmount alone is only set for invoiced jobs, so Cost per Job sat
  // at zero for most jobs; fall back through the cost fields that are actually
  // populated.
  const jobCost = (job: ContractorJob) =>
    job.totalProjectCost ?? job.systemInvoiceAmount ?? job.contractorInvoiceAmount ?? 0;

  // Rolling 12-month window ending this month, rather than a fixed calendar
  // year — a contractor's jobs rarely land neatly within Jan-Dec of "now", so
  // pinning to currentYear silently dropped everything from a prior year and
  // the charts looked frozen/empty even though jobs kept coming in.
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, offset) => {
    const bucket = new Date(now.getFullYear(), now.getMonth() - (11 - offset), 1);
    const month = bucket.toLocaleString('en', { month: 'short', year: '2-digit' });
    const monthJobs = jobs.filter((job) => {
      const created = job.createdAt?.toDate ? job.createdAt.toDate() : null;
      return created
        ? created.getFullYear() === bucket.getFullYear() && created.getMonth() === bucket.getMonth()
        : false;
    });
    const ratedJobs = monthJobs.filter((job) => job.rating?.overallScore != null);
    return {
      month,
      jobs: monthJobs.length,
      rating: ratedJobs.length
        ? ratedJobs.reduce((sum, job) => sum + (job.rating?.overallScore ?? 0), 0) / ratedJobs.length
        : 0,
      cost: monthJobs.length
        ? monthJobs.reduce((sum, job) => sum + jobCost(job), 0) / monthJobs.length
        : 0,
    };
  });

  // Distribution across whatever job types actually occur, normalised to a
  // readable label — the old fixed ['breakdown','pm','installation'] substring
  // buckets never matched values like 'preventive_maintenance' and dropped
  // every other type, so the pie looked frozen.
  const TYPE_LABELS: Record<string, string> = {
    breakdown_repair: t('common.contractors.registry.analyticsTab.jobTypes.breakdown'), breakdown: t('common.contractors.registry.analyticsTab.jobTypes.breakdown'),
    preventive_maintenance: t('common.contractors.registry.analyticsTab.jobTypes.preventive'), preventive: t('common.contractors.registry.analyticsTab.jobTypes.preventive'), pm: t('common.contractors.registry.analyticsTab.jobTypes.preventive'),
    corrective_maintenance: t('common.contractors.registry.analyticsTab.jobTypes.corrective'), corrective: t('common.contractors.registry.analyticsTab.jobTypes.corrective'),
    installation: t('common.contractors.registry.analyticsTab.jobTypes.installation'), modification: t('common.contractors.registry.analyticsTab.jobTypes.modification'), inspection: t('common.contractors.registry.analyticsTab.jobTypes.inspection'),
  };
  const distMap = new Map<string, number>();
  for (const job of jobs) {
    const raw = (job.workOrderType ?? '').toLowerCase().trim();
    const label = TYPE_LABELS[raw] ?? (raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : t('common.contractors.registry.analyticsTab.jobTypes.other'));
    distMap.set(label, (distMap.get(label) ?? 0) + 1);
  }
  const distribution = [...distMap.entries()].map(([name, value]) => ({ name, value }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">{t('common.contractors.registry.analyticsTab.jobsPerMonth')}</h2>
        <div className="mt-4 h-64"><ResponsiveContainer><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="jobs" fill="#1A56DB" /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">{t('common.contractors.registry.analyticsTab.ratingTrend')}</h2>
        <div className="mt-4 h-64"><ResponsiveContainer><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 5]} /><Tooltip /><Line dataKey="rating" stroke="#10B981" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">{t('common.contractors.registry.analyticsTab.costPerJob')}</h2>
        <div className="mt-4 h-64"><ResponsiveContainer><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="cost" fill="#00C2FF" /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">{t('common.contractors.registry.analyticsTab.jobTypeDistribution')}</h2>
        <div className="mt-4 h-64"><ResponsiveContainer><PieChart><Pie data={distribution} dataKey="value" nameKey="name" fill="#1A56DB" label /></PieChart></ResponsiveContainer></div>
      </section>
    </div>
  );
}

export default ContractorAnalyticsTab;
