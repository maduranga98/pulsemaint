import { Navigate, Routes, Route } from 'react-router-dom';
import { useAuthInit } from '../hooks/useAuthInit';
import AuthLoading from '../components/auth/AuthLoading';
import ProtectedRoute, { PublicRoute } from '../components/auth/ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';

// Auth pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import InvitePage from '../pages/auth/InvitePage';
import OnboardingWizard from '../pages/auth/OnboardingWizard';
import UnauthorizedPage from '../pages/auth/UnauthorizedPage';

// Machine pages
import {
  MachineListPage,
  AddMachinePage,
  MachineProfilePage,
  EditMachinePage,
  MachineQrPage,
} from '../pages/machines';

// Stubs for not-yet-built pages
const Dashboard = () => <div className="p-8">Dashboard Page</div>;
const BreakdownsPage = () => <div className="p-8">Breakdowns Page</div>;
const ReportBreakdownPage = () => <div className="p-8">Report Breakdown Page</div>;
const WorkOrdersPage = () => <div className="p-8">Work Orders Page</div>;
const InventoryPage = () => <div className="p-8">Inventory Page</div>;
const TrainingPage = () => <div className="p-8">Training Page</div>;
const MyTrainingPage = () => <div className="p-8">My Training Modules Page</div>;
const SettingsPage = () => <div className="p-8">Settings Page</div>;
const UsersPage = () => <div className="p-8">Users Management Page</div>;

export default function AppRouter() {
  const { isInitialized } = useAuthInit();

  if (!isInitialized) {
    return <AuthLoading />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
      <Route path="/invite/:token" element={<PublicRoute><InvitePage /></PublicRoute>} />

      {/* Full-screen authed flows (no app shell) */}
      <Route
        path="/app/onboarding"
        element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>}
      />
      <Route
        path="/app/unauthorized"
        element={<ProtectedRoute><UnauthorizedPage /></ProtectedRoute>}
      />

      {/* Protected app shell – sidebar + header wrap every page below */}
      <Route
        path="/app"
        element={<ProtectedRoute><AppLayout /></ProtectedRoute>}
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />

        <Route
          path="dashboard"
          element={
            <ProtectedRoute requiredRoles={['plant_manager', 'admin']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Machines */}
        <Route
          path="machines"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <MachineListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="machines/new"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <AddMachinePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="machines/:id"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <MachineProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="machines/:id/edit"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <EditMachinePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="machines/:id/qr"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <MachineQrPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="breakdowns"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <BreakdownsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="breakdowns/report"
          element={
            <ProtectedRoute requiredRoles={['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin']}>
              <ReportBreakdownPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="work-orders"
          element={
            <ProtectedRoute requiredRoles={['technician', 'supervisor', 'plant_manager', 'admin']}>
              <WorkOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training"
          element={
            <ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}>
              <TrainingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/my-modules"
          element={
            <ProtectedRoute requiredRoles={['trainee', 'floor_operator']}>
              <MyTrainingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/users"
          element={
            <ProtectedRoute requiredRoles={['admin', 'supervisor']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Legacy /machines/* -> /app/machines */}
      <Route path="/machines" element={<Navigate to="/app/machines" replace />} />
      <Route path="/machines/*" element={<Navigate to="/app/machines" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
