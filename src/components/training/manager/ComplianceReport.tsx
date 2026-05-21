import type { Timestamp } from 'firebase/firestore';
import type { ComplianceStats, ComplianceMatrixRow } from '@/hooks/training/useComplianceData';
import type { AssignmentStatus } from '@/lib/training/trainingTypes';
import {
  Users,
  Award,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Download,
  Loader2,
} from 'lucide-react';

interface ComplianceReportProps {
  stats: ComplianceStats;
  matrixRows: ComplianceMatrixRow[];
  moduleHeaders: { moduleId: string; moduleName: string }[];
  loading: boolean;
  onExport: () => void;
}

function formatTs(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  const date = new Date((ts as unknown as { seconds: number }).seconds * 1000);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function abbreviate(name: string): string {
  return name.length > 18 ? name.slice(0, 16) + '…' : name;
}

type CellStatus = AssignmentStatus | 'not_assigned';

function CellContent({
  status,
  certifiedAt,
}: {
  status: CellStatus;
  certifiedAt?: Timestamp;
}) {
  if (status === 'certified') {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-green-600 font-bold text-base leading-none">
          ✓
        </span>
        {certifiedAt && (
          <span className="text-green-700 text-xs leading-none">
            {formatTs(certifiedAt)}
          </span>
        )}
      </div>
    );
  }
  if (status === 'not_assigned') {
    return <span className="text-gray-300 text-base font-medium">–</span>;
  }
  if (status === 'expired') {
    return <span className="text-red-500 text-base font-bold">×</span>;
  }
  if (status === 'in_progress') {
    return <span className="text-blue-500 text-base font-bold">⟳</span>;
  }
  // Other active statuses
  return <span className="text-amber-500 text-base font-bold">◌</span>;
}

function StatCard({
  label,
  value,
  icon,
  colorClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function ComplianceReport({
  stats,
  matrixRows,
  moduleHeaders,
  loading,
  onExport,
}: ComplianceReportProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats + Export */}
      <div className="flex items-start justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
          <StatCard
            label="Total Operators"
            value={stats.totalTrainees}
            icon={<Users className="w-5 h-5 text-blue-600" />}
            colorClass="bg-blue-50"
          />
          <StatCard
            label="Certified"
            value={stats.certified}
            icon={<Award className="w-5 h-5 text-green-600" />}
            colorClass="bg-green-50"
          />
          <StatCard
            label="Not Certified"
            value={stats.notCertified}
            icon={<XCircle className="w-5 h-5 text-red-500" />}
            colorClass="bg-red-50"
          />
          <StatCard
            label="Expiring Soon"
            value={stats.expiringSoon}
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            colorClass="bg-amber-50"
          />
          <StatCard
            label="Overdue"
            value={stats.overdueAssignments}
            icon={<AlertTriangle className="w-5 h-5 text-orange-600" />}
            colorClass="bg-orange-50"
          />
          <StatCard
            label="Retraining Pending"
            value={stats.retrainingRequired}
            icon={<RefreshCw className="w-5 h-5 text-purple-600" />}
            colorClass="bg-purple-50"
          />
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex-shrink-0"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Compliance Matrix */}
      {matrixRows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-sm text-gray-400">
          No compliance data available.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Compliance Matrix</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm min-w-max">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-40 sticky left-0 bg-gray-50 z-10">
                    Trainee
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-28 sticky left-40 bg-gray-50 z-10">
                    Department
                  </th>
                  {moduleHeaders.map((h) => (
                    <th
                      key={h.moduleId}
                      className="text-center px-3 py-3 font-medium text-gray-600 min-w-24"
                      title={h.moduleName}
                    >
                      {abbreviate(h.moduleName)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matrixRows.map((row) => (
                  <tr
                    key={row.traineeId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-white z-10">
                      {row.traineeName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 sticky left-40 bg-white z-10">
                      {row.department}
                    </td>
                    {moduleHeaders.map((h) => {
                      const cell = row.modules[h.moduleId] ?? {
                        status: 'not_assigned' as const,
                      };
                      return (
                        <td
                          key={h.moduleId}
                          className="px-3 py-3 text-center"
                        >
                          <CellContent
                            status={cell.status}
                            certifiedAt={cell.certifiedAt}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="text-green-600 font-bold">✓</span> Certified
        </span>
        <span className="flex items-center gap-1">
          <span className="text-blue-500 font-bold">⟳</span> In Progress
        </span>
        <span className="flex items-center gap-1">
          <span className="text-amber-500 font-bold">◌</span> Other
        </span>
        <span className="flex items-center gap-1">
          <span className="text-red-500 font-bold">×</span> Expired
        </span>
        <span className="flex items-center gap-1">
          <span className="text-gray-300 font-bold">–</span> Not Assigned
        </span>
      </div>
    </div>
  );
}
