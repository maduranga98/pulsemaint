import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Contractor } from '@/lib/contractors/contractorTypes';

interface ContractorComparisonChartProps {
  contractors: Contractor[];
  metric: 'totalJobsCount' | 'avgRating' | 'avgJobCost';
  title: string;
}

export function ContractorComparisonChart({ contractors, metric, title }: ContractorComparisonChartProps) {
  const data = contractors.slice(0, 10).map((contractor) => ({
    name: contractor.tradeName || contractor.companyName,
    value: contractor[metric],
  }));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 h-72">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} />
            <Tooltip />
            <Bar dataKey="value" fill="#1A56DB" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default ContractorComparisonChart;
