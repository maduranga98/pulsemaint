import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { subMonths, format } from 'date-fns';
import { useConditionReadings } from '../../hooks/useConditionReadings';
import { useAuthStore } from '../../store/authStore';
import type { ConditionReading, ConditionReadingDraft } from '../../types/conditionMonitoring';
import { toast } from 'sonner';

interface ConditionMonitoringTabProps {
  machine: { id: string; siteId: string };
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: ConditionReading & { isOutOfRange?: boolean };
}

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined) return null;
  const isOut = payload?.isOutOfRange;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={isOut ? '#ef4444' : '#3b82f6'}
      stroke={isOut ? '#b91c1c' : '#2563eb'}
      strokeWidth={1}
    />
  );
}

const emptyDraft = (): ConditionReadingDraft => ({
  parameter: '',
  value: '',
  unit: '',
  min: '',
  max: '',
});

export function ConditionMonitoringTab({ machine }: ConditionMonitoringTabProps) {
  const user = useAuthStore((s) => s.user);
  const userProfile = useAuthStore((s) => s.userProfile);
  const uid = user?.uid ?? '';
  const userName = user?.displayName ?? userProfile?.id ?? '';

  const { readings, loading, parameterGroups, addReading } = useConditionReadings({
    machineId: machine.id,
    siteId: machine.siteId,
  });

  const [draft, setDraft] = useState<ConditionReadingDraft>(emptyDraft());
  const [submitting, setSubmitting] = useState(false);

  // Collect existing parameter names for datalist suggestions
  const existingParameters = useMemo(() => Object.keys(parameterGroups), [parameterGroups]);

  // Filter to last 6 months
  const sixMonthsAgo = subMonths(new Date(), 6);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.parameter.trim()) {
      toast.error('Parameter name is required');
      return;
    }
    if (draft.value === '') {
      toast.error('Value is required');
      return;
    }
    setSubmitting(true);
    try {
      await addReading(draft, uid, userName);
      toast.success('Reading logged');
      setDraft(emptyDraft());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to log reading';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Log New Reading */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Log New Reading</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Parameter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parameter</label>
              <input
                type="text"
                list="parameter-suggestions"
                value={draft.parameter}
                onChange={(e) => setDraft({ ...draft, parameter: e.target.value })}
                placeholder="e.g. Bearing Temp, Vibration"
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <datalist id="parameter-suggestions">
                {existingParameters.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>

            {/* Value */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
              <input
                type="number"
                step="any"
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="e.g. 75.3"
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <input
                type="text"
                value={draft.unit}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                placeholder="e.g. °C, mm/s, bar"
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Min */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min (optional)</label>
              <input
                type="number"
                step="any"
                value={draft.min}
                onChange={(e) => setDraft({ ...draft, min: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="Acceptable min"
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Max */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max (optional)</label>
              <input
                type="number"
                step="any"
                value={draft.max}
                onChange={(e) => setDraft({ ...draft, max: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="Acceptable max"
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Logging...' : 'Log Reading'}
          </button>
        </form>
      </div>

      {/* Charts section */}
      <div className="space-y-6">
        {loading && (
          <p className="text-sm text-gray-400 text-center py-4">Loading readings...</p>
        )}

        {!loading && readings.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">No readings logged yet. Use the form above to log the first reading.</p>
          </div>
        )}

        {Object.entries(parameterGroups).map(([parameter, paramReadings]) => {
          // Filter to last 6 months and sort ascending for chart
          const filteredReadings = paramReadings
            .filter((r) => {
              try {
                const date = r.takenAt.toDate ? r.takenAt.toDate() : new Date((r.takenAt as any).seconds * 1000);
                return date >= sixMonthsAgo;
              } catch {
                return false;
              }
            })
            .sort((a, b) => {
              const aTime = a.takenAt.toDate ? a.takenAt.toDate().getTime() : (a.takenAt as any).seconds * 1000;
              const bTime = b.takenAt.toDate ? b.takenAt.toDate().getTime() : (b.takenAt as any).seconds * 1000;
              return aTime - bTime;
            });

          if (filteredReadings.length === 0) return null;

          // Determine unit and acceptable range from readings
          const unit = filteredReadings[filteredReadings.length - 1]?.unit ?? '';
          const minVals = filteredReadings.map((r) => r.min).filter((v): v is number => v !== null);
          const maxVals = filteredReadings.map((r) => r.max).filter((v): v is number => v !== null);
          const acceptableMin = minVals.length > 0 ? Math.min(...minVals) : null;
          const acceptableMax = maxVals.length > 0 ? Math.max(...maxVals) : null;

          // Build chart data
          const chartData = filteredReadings.map((r) => {
            const date = r.takenAt.toDate ? r.takenAt.toDate() : new Date((r.takenAt as any).seconds * 1000);
            const isOutOfRange =
              acceptableMin !== null &&
              acceptableMax !== null &&
              (r.value < acceptableMin || r.value > acceptableMax);
            return {
              ...r,
              dateLabel: format(date, 'MMM d'),
              isOutOfRange,
            };
          });

          return (
            <div key={parameter} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">{parameter}</h4>
                {unit && <span className="text-sm text-gray-500">{unit}</span>}
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value: number) => [`${value} ${unit}`, parameter]}
                  />

                  {/* Reference area for acceptable band */}
                  {acceptableMin !== null && acceptableMax !== null && (
                    <ReferenceArea
                      y1={acceptableMin}
                      y2={acceptableMax}
                      fill="#d1fae5"
                      fillOpacity={0.4}
                      strokeOpacity={0}
                    />
                  )}

                  {/* Min/max reference lines */}
                  {acceptableMin !== null && (
                    <ReferenceLine
                      y={acceptableMin}
                      stroke="#10b981"
                      strokeDasharray="4 2"
                      label={{ value: `min ${acceptableMin}`, fontSize: 10, fill: '#10b981' }}
                    />
                  )}
                  {acceptableMax !== null && (
                    <ReferenceLine
                      y={acceptableMax}
                      stroke="#10b981"
                      strokeDasharray="4 2"
                      label={{ value: `max ${acceptableMax}`, fontSize: 10, fill: '#10b981' }}
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={<CustomDot />}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}
