import { Link } from 'react-router-dom';
import {
  Users,
  BookOpen,
  Award,
  AlertTriangle,
  RefreshCw,
  Layers,
  Plus,
  BarChart2,
} from 'lucide-react';
import { Globe2, FileClock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import { isOffboardAssignment } from '@/lib/training/offboardTraining';

const CAN_AUTHOR_ROLES = ['plant_manager', 'admin', 'hr_officer'];

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
  allAssignments?: TrainingAssignment[];
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
  allAssignments = [],
  recentActivity = [],
}: TrainingDashboardProps) {
  const role = useAuthStore((s) => s.userProfile?.role);
  const canAuthor = !!role && CAN_AUTHOR_ROLES.includes(role);

  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const offboardAssignments = allAssignments.filter(isOffboardAssignment);
  const offboardThisQuarter = offboardAssignments.filter((a) => {
    const assignedAt = (a.assignedAt as unknown as { toDate?: () => Date })?.toDate?.();
    return assignedAt ? assignedAt >= quarterStart : false;
  }).length;
  const pendingKnowledgeReports = offboardAssignments.filter(
    (a) => !a.offboardCompletion?.reportSubmittedAt
  ).length;

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
        <StatCard
          label="Offboard Trainings This Quarter"
          value={offboardThisQuarter}
          icon={<Globe2 className="w-6 h-6 text-fuchsia-600" />}
          colorClass="bg-fuchsia-50"
        />
        <StatCard
          label="Pending Knowledge Reports"
          value={pendingKnowledgeReports}
          icon={<FileClock className="w-6 h-6 text-orange-600" />}
          colorClass="bg-orange-50"
        />
      </div>

      {/* Quick Actions — Training-only actions; trainee assignment tracking
          (sign-off, assignment lists) lives in Trainee Management, not here,
          so this dashboard never links into that feature. */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {canAuthor && (
            <Link
              to="/app/training/manage/modules/new"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Module
            </Link>
          )}
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
