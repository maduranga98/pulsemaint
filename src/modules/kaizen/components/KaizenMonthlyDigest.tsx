import { useState } from 'react';
import { format, startOfMonth, endOfMonth, parse } from 'date-fns';
import { Printer, Lock } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useKaizenList, useKaizenStats } from '../hooks/useKaizen';
import {
  KAIZEN_STATUS_META,
  KAIZEN_CATEGORY_META,
  KAIZEN_PRIORITY_META,
} from '../types/kaizen.types';

interface Props {
  isProPlan?: boolean;
  defaultMonth?: string; // YYYY-MM
}

export function KaizenMonthlyDigest({ isProPlan = false, defaultMonth }: Props) {
  const companyName = useAuthStore((s) => s.company?.name ?? 'Plant');
  const [selectedMonth, setSelectedMonth] = useState(
    defaultMonth ?? format(new Date(), 'yyyy-MM')
  );

  const monthStart = format(startOfMonth(parse(selectedMonth, 'yyyy-MM', new Date())), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(parse(selectedMonth, 'yyyy-MM', new Date())), 'yyyy-MM-dd');

  const { cards: allCards, loading } = useKaizenList({});
  const { stats } = useKaizenStats({ startDate: monthStart, endDate: monthEnd });

  const monthCards = allCards.filter((card) => {
    const raised = card.raisedAt?.toDate();
    if (!raised) return false;
    const m = format(raised, 'yyyy-MM');
    return m === selectedMonth;
  });

  const implementedThisMonth = allCards.filter((card) => {
    if (!card.implementedAt) return false;
    const m = format(card.implementedAt.toDate(), 'yyyy-MM');
    return m === selectedMonth;
  });

  const verifiedThisMonth = allCards.filter((card) => {
    if (!card.verifiedAt) return false;
    const m = format(card.verifiedAt.toDate(), 'yyyy-MM');
    return m === selectedMonth;
  });

  const topContributor = stats?.topContributors?.[0];

  if (!isProPlan) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 flex flex-col items-center text-center gap-3">
        <Lock size={28} className="text-gray-400" />
        <p className="text-base font-semibold text-gray-700">Monthly Kaizen Digest — Factory Pro</p>
        <p className="text-sm text-gray-500 max-w-sm">
          Generate PDF reports of monthly Kaizen activity, including new cards, implementations, ROI,
          and top contributor recognition.
        </p>
        <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Upgrade to Factory Pro
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Printer size={14} /> Print / Export PDF
        </button>
      </div>

      {/* Digest content */}
      <div
        id="kaizen-digest-print"
        className="bg-white border border-gray-200 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#0A1628] text-white px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-blue-300 uppercase font-semibold mb-1">Kaizen Monthly Digest</p>
              <h1 className="text-2xl font-bold">{companyName}</h1>
              <p className="text-blue-200 mt-0.5">
                {format(parse(selectedMonth, 'yyyy-MM', new Date()), 'MMMM yyyy')}
              </p>
            </div>
            <div className="text-right text-xs text-blue-300">
              <p>Generated: {format(new Date(), 'dd MMM yyyy')}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="py-8 text-center text-gray-400 animate-pulse">Generating digest...</div>
          ) : (
            <>
              {/* KPI summary */}
              <section>
                <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b border-gray-200">
                  Monthly Summary
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'New Cards Raised', value: monthCards.length },
                    { label: 'Implemented', value: implementedThisMonth.length },
                    { label: 'Verified', value: verifiedThisMonth.length },
                    {
                      label: 'Implementation Rate',
                      value: stats ? `${stats.implementationRate}%` : '—',
                    },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* New cards raised */}
              {monthCards.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b border-gray-200">
                    New Cards Raised ({monthCards.length})
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="py-1.5 pr-3">Title</th>
                        <th className="py-1.5 pr-3">Category</th>
                        <th className="py-1.5 pr-3">Priority</th>
                        <th className="py-1.5 pr-3">Raised By</th>
                        <th className="py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthCards.map((c) => (
                        <tr key={c.id}>
                          <td className="py-1.5 pr-3 font-medium text-gray-800">{c.title}</td>
                          <td className="py-1.5 pr-3 text-xs">
                            {KAIZEN_CATEGORY_META[c.category].icon} {KAIZEN_CATEGORY_META[c.category].label}
                          </td>
                          <td className="py-1.5 pr-3">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                              style={{
                                color: KAIZEN_PRIORITY_META[c.priority].color,
                                backgroundColor: KAIZEN_PRIORITY_META[c.priority].bgColor,
                              }}
                            >
                              {KAIZEN_PRIORITY_META[c.priority].label}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-gray-600">{c.raisedByName}</td>
                          <td className="py-1.5">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                              style={{
                                color: KAIZEN_STATUS_META[c.status].color,
                                backgroundColor: KAIZEN_STATUS_META[c.status].bgColor,
                              }}
                            >
                              {KAIZEN_STATUS_META[c.status].label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* Implemented this month */}
              {implementedThisMonth.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b border-gray-200">
                    Implemented This Month ({implementedThisMonth.length})
                  </h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="py-1.5 pr-3">Title</th>
                        <th className="py-1.5 pr-3">Category</th>
                        <th className="py-1.5 pr-3">Actual Cost (LKR)</th>
                        <th className="py-1.5">Actual Benefit/mo (LKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {implementedThisMonth.map((c) => (
                        <tr key={c.id}>
                          <td className="py-1.5 pr-3 font-medium text-gray-800">{c.title}</td>
                          <td className="py-1.5 pr-3 text-xs">
                            {KAIZEN_CATEGORY_META[c.category].icon} {KAIZEN_CATEGORY_META[c.category].label}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-700">
                            {c.actualCost != null ? c.actualCost.toLocaleString() : '—'}
                          </td>
                          <td className="py-1.5 text-emerald-700 font-medium">
                            {c.actualBenefit != null ? c.actualBenefit.toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* Top contributor shoutout */}
              {topContributor && (
                <section className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {topContributor.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase">Top Contributor This Month</p>
                    <p className="text-base font-bold text-blue-900">{topContributor.name}</p>
                    <p className="text-sm text-blue-700">{topContributor.count} Kaizen card{topContributor.count !== 1 ? 's' : ''} raised</p>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
