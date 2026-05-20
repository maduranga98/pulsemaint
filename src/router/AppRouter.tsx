import { Navigate, Routes, Route } from 'react-router-dom';
import { useAuthInit } from '../hooks/useAuthInit';
import AuthLoading from '../components/auth/AuthLoading';
import ProtectedRoute, { PublicRoute } from '../components/auth/ProtectedRoute';

// Auth pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import InvitePage from '../pages/auth/InvitePage';
import OnboardingWizard from '../pages/auth/OnboardingWizard';
import UnauthorizedPage from '../pages/auth/UnauthorizedPage';

// App pages (stubs - will be implemented separately)
const Dashboard = () => <div className="p-8 min-h-screen bg-white">Dashboard Page</div>;
const BreakdownsPage = () => <div className="p-8 min-h-screen bg-white">Breakdowns Page</div>;
const ReportBreakdownPage = () => <div className="p-8 min-h-screen bg-white">Report Breakdown Page</div>;
const WorkOrdersPage = () => <div className="p-8 min-h-screen bg-white">Work Orders Page</div>;
const InventoryPage = () => <div className="p-8 min-h-screen bg-white">Inventory Page</div>;
const TrainingPage = () => <div className="p-8 min-h-screen bg-white">Training Page</div>;
const MyTrainingPage = () => <div className="p-8 min-h-screen bg-white">My Training Modules Page</div>;
const SettingsPage = () => <div className="p-8 min-h-screen bg-white">Settings Page</div>;
const UsersPage = () => <div className="p-8 min-h-screen bg-white">Users Management Page</div>;

export default function AppRouter() {
  const { isInitialized } = useAuthInit();

  if (!isInitialized) {
    return <AuthLoading />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />

      <Route
        path="/verify-email"
        element={
          <PublicRoute>
            <VerifyEmailPage />
          </PublicRoute>
        }
      />

      <Route
        path="/invite/:token"
        element={
          <PublicRoute>
            <InvitePage />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />

      <Route
        path="/app/unauthorized"
        element={
          <ProtectedRoute>
            <UnauthorizedPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingWizard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/dashboard"
        element={
          <ProtectedRoute requiredRoles={['plant_manager', 'admin']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/breakdowns"
        element={
          <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
            <BreakdownsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/breakdowns/report"
        element={
          <ProtectedRoute requiredRoles={['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin']}>
            <ReportBreakdownPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/work-orders"
        element={
          <ProtectedRoute requiredRoles={['technician', 'supervisor', 'plant_manager', 'admin']}>
            <WorkOrdersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/inventory"
        element={
          <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
            <InventoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/training"
        element={
          <ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}>
            <TrainingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/training/my-modules"
        element={
          <ProtectedRoute requiredRoles={['trainee', 'floor_operator']}>
            <MyTrainingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/settings"
        element={
          <ProtectedRoute requiredRoles={['admin']}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/settings/users"
        element={
          <ProtectedRoute requiredRoles={['admin', 'supervisor']}>
            <UsersPage />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
