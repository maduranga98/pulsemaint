import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types/auth';

const DASHBOARD_BY_ROLE: Record<UserRole, string> = {
  admin: '/app/dashboard/manager',
  plant_manager: '/app/dashboard/manager',
  supervisor: '/app/dashboard/supervisor',
  technician: '/app/dashboard/technician',
  store_keeper: '/app/dashboard/inventory',
  hr_officer: '/app/dashboard/training',
  trainee: '/app/dashboard', // No access — will hit unauthorized
  floor_operator: '/app/dashboard', // No access
};

export default function DashboardPage() {
  const role = useAuthStore((s) => s.userProfile?.role);

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  const target = DASHBOARD_BY_ROLE[role];
  if (!target || target === '/app/dashboard') {
    return <Navigate to="/app/unauthorized" replace />;
  }

  return <Navigate to={target} replace />;
}
