import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Contractor, ContractorJob } from '@/lib/contractors/contractorTypes';

interface ContractorAnalyticsTabProps {
  contractor: Contractor;
  jobs: ContractorJob[];
}

export function ContractorAnalyticsTab({ contractor, jobs }: ContractorAnalyticsTabProps) {
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(new Date().getFullYear(), index, 1).toLocaleString('en', { month: 'short' });
    const monthJobs = jobs.filter((job) => job.createdAt.toDate().getMonth() === index);
    return {
      month,
      jobs: monthJobs.length,
      rating: monthJobs.reduce((sum, job) => sum + (job.rating?.overallScore ?? 0), 0) / Math.max(1, monthJobs.filter((job) => job.rating).length),
      cost: monthJobs.reduce((sum, job) => sum + (job.systemInvoiceAmount ?? 0), 0) / Math.max(1, monthJobs.length),
    };
  });
  const distribution = ['breakdown', 'pm', 'installation'].map((name) => ({
    name,
    value: jobs.filter((job) => job.workOrderType.toLowerCase().includes(name)).length,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Jobs per Month</h2>
        <div className="mt-4 h-64"><ResponsiveContainer><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="jobs" fill="#1A56DB" /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Rating Trend</h2>
        <div className="mt-4 h-64"><ResponsiveContainer><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 5]} /><Tooltip /><Line dataKey="rating" stroke="#10B981" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Cost per Job</h2>
        <div className="mt-4 h-64"><ResponsiveContainer><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="cost" fill="#00C2FF" /></BarChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-950">Job Type Distribution</h2>
        <div className="mt-4 h-64"><ResponsiveContainer><PieChart><Pie data={distribution} dataKey="value" nameKey="name" fill="#1A56DB" label /></PieChart></ResponsiveContainer></div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4 xl:col-span-2">
        <h2 className="font-semibold text-slate-950">Comparison</h2>
        <p className="mt-2 text-sm text-slate-600">How {contractor.companyName} compares to your other contractors</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-slate-50 p-3">Rating rank: <span className="font-bold">#{contractor.avgRating ? 1 : '-'}</span></div>
          <div className="rounded-md bg-slate-50 p-3">MTTR: <span className="font-bold">{contractor.avgMttr} min</span></div>
          <div className="rounded-md bg-slate-50 p-3">Avg cost: <span className="font-bold">{contractor.avgJobCost.toLocaleString()}</span></div>
        </div>
      </section>
    </div>
  );
}

export default ContractorAnalyticsTab;
