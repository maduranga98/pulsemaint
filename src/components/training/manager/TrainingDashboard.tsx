import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  Award,
  AlertTriangle,
  RefreshCw,
  Layers,
  ClipboardCheck,
  Plus,
  BarChart2,
} from 'lucide-react';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';

interface DashboardStats {
  totalTrainees: number;
  activeAssignments: number;
  certsThisMonth: number;
  overdue: number;
  retrainingRequired: number;
  modulesCreated: number;
}

interface TrainingDashboardProps {
  stats: DashboardStats;
  awaitingSignOff: TrainingAssignment[];
  onSignOff: (assignmentId: string) => void;
  recentActivity?: string[];
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

function StatCard({ label, value, icon, colorClass }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function TrainingDashboard({
  stats,
  awaitingSignOff,
  onSignOff,
  recentActivity = [],
}: TrainingDashboardProps) {
  const topFiveSignOff = awaitingSignOff.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {stats.overdue > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            {stats.overdue} assignment{stats.overdue !== 1 ? 's are' : ' is'} overdue. Review and follow up with trainees.
          </span>
        </div>
      )}
      {stats.retrainingRequired > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800">
          <RefreshCw className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            {stats.retrainingRequired} trainee{stats.retrainingRequired !== 1 ? 's require' : ' requires'} retraining.
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Trainees"
          value={stats.totalTrainees}
          icon={<Users className="w-6 h-6 text-blue-600" />}
          colorClass="bg-blue-50"
        />
        <StatCard
          label="Active Assignments"
          value={stats.activeAssignments}
          icon={<BookOpen className="w-6 h-6 text-indigo-600" />}
          colorClass="bg-indigo-50"
        />
        <StatCard
          label="Certs This Month"
          value={stats.certsThisMonth}
          icon={<Award className="w-6 h-6 text-green-600" />}
          colorClass="bg-green-50"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
          colorClass="bg-amber-50"
        />
        <StatCard
          label="Retraining Required"
          value={stats.retrainingRequired}
          icon={<RefreshCw className="w-6 h-6 text-red-600" />}
          colorClass="bg-red-50"
        />
        <StatCard
          label="Modules Created"
          value={stats.modulesCreated}
          icon={<Layers className="w-6 h-6 text-purple-600" />}
          colorClass="bg-purple-50"
        />
      </div>

      {/* Awaiting Practical Sign-Off */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Awaiting Practical Sign-Off</h2>
          </div>
          {awaitingSignOff.length > 5 && (
            <Link
              to="/app/training/manage/assignments"
              className="text-sm text-blue-600 hover:underline"
            >
              View all {awaitingSignOff.length}
            </Link>
          )}
        </div>

        {topFiveSignOff.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500 text-sm">
            No practical assessments awaiting sign-off.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {topFiveSignOff.map((assignment) => (
              <div
                key={assignment.id}
                className="px-5 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{assignment.traineeName}</p>
                  <p className="text-sm text-gray-500 truncate">{assignment.moduleName}</p>
                </div>
                <div className="text-sm text-gray-600 flex-shrink-0">
                  Quiz: <span className="font-semibold text-gray-900">{assignment.bestScore}%</span>
                </div>
                <button
                  onClick={() => onSignOff(assignment.id)}
                  className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign Off
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/app/training/manage/assign"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Assign Training
          </Link>
          <Link
            to="/app/training/manage/modules/new"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Module
          </Link>
          <Link
            to="/app/training/manage/compliance"
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            View Compliance
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Recent Activity</h2>
          <ul className="space-y-2">
            {recentActivity.map((item, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
