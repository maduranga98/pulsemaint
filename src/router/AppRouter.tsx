import { Navigate, Routes, Route } from 'react-router-dom';
import { useAuthInit } from '../hooks/useAuthInit';
import AuthLoading from '../components/auth/AuthLoading';
import ProtectedRoute, { PublicRoute } from '../components/auth/ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';

// Training pages - Trainee
import MyModulesPage from '../pages/training/MyModulesPage';
import ModuleLearningPage from '../pages/training/ModuleLearningPage';
import QuizPage from '../pages/training/QuizPage';
import MyCertificatesPage from '../pages/training/MyCertificatesPage';

// Training pages - Management
import TrainingDashboardPage from '../pages/training/manage/TrainingDashboardPage';
import ModuleLibraryPage from '../pages/training/manage/ModuleLibraryPage';
import CreateModulePage from '../pages/training/manage/CreateModulePage';
import EditModulePage from '../pages/training/manage/EditModulePage';
import QuizBuilderPage from '../pages/training/manage/QuizBuilderPage';
import AssignTrainingPage from '../pages/training/manage/AssignTrainingPage';
import AssignmentsListPage from '../pages/training/manage/AssignmentsListPage';
import TraineeProfilePage from '../pages/training/manage/TraineeProfilePage';
import CertificatesManagerPage from '../pages/training/manage/CertificatesManagerPage';
import ComplianceReportPage from '../pages/training/manage/ComplianceReportPage';
import ContentLibraryPage from '../pages/training/manage/ContentLibraryPage';

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

// Triage pages
import TriageRunnerPage from '../pages/triage/TriageRunnerPage';
import TriageCompletePage from '../pages/triage/TriageCompletePage';
import TriageHistoryPage from '../pages/triage/TriageHistoryPage';
import TriageSessionDetailPage from '../pages/triage/TriageSessionDetailPage';
import TriageBuilderLibraryPage from '../pages/triage-builder/TriageBuilderLibraryPage';
import TriageBuilderCreatePage from '../pages/triage-builder/TriageBuilderCreatePage';
import TriageBuilderEditPage from '../pages/triage-builder/TriageBuilderEditPage';
import TriageBuilderFlowDetailPage from '../pages/triage-builder/TriageBuilderFlowDetailPage';
import TriageBuilderTemplatesPage from '../pages/triage-builder/TriageBuilderTemplatesPage';

// Inventory pages
import InventoryDashboardPage from '../pages/inventory/InventoryDashboardPage';
import PartCatalogPage from '../pages/inventory/PartCatalogPage';
import AddPartPage from '../pages/inventory/AddPartPage';
import PartDetailPage from '../pages/inventory/PartDetailPage';
import EditPartPage from '../pages/inventory/EditPartPage';
import PartsRequestsPage from '../pages/inventory/PartsRequestsPage';
import RequestDetailPage from '../pages/inventory/RequestDetailPage';
import PhysicalIssuePage from '../pages/inventory/PhysicalIssuePage';
import ReceiveStockPage from '../pages/inventory/ReceiveStockPage';
import StockMovementLogPage from '../pages/inventory/StockMovementLogPage';
import PurchaseOrdersPage from '../pages/inventory/PurchaseOrdersPage';
import CreatePurchaseOrderPage from '../pages/inventory/CreatePurchaseOrderPage';
import PurchaseOrderDetailPage from '../pages/inventory/PurchaseOrderDetailPage';
import ExcelImportPage from '../pages/inventory/ExcelImportPage';
import ImportHistoryPage from '../pages/inventory/ImportHistoryPage';
import InventoryReportsPage from '../pages/inventory/InventoryReportsPage';
import InventorySettingsPage from '../pages/inventory/InventorySettingsPage';

// Stubs for not-yet-built pages
const Dashboard = () => <div className="p-8">Dashboard Page</div>;
const BreakdownsPage = () => <div className="p-8">Breakdowns Page</div>;
const ReportBreakdownPage = () => <div className="p-8">Report Breakdown Page</div>;
const WorkOrdersPage = () => <div className="p-8">Work Orders Page</div>;
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

      {/* Triage runner — full-screen, outside AppLayout */}
      <Route
        path="/app/triage/:sessionId"
        element={
          <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
            <TriageRunnerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/triage/:sessionId/complete"
        element={
          <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
            <TriageCompletePage />
          </ProtectedRoute>
        }
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
        {/* Inventory */}
        <Route
          path="inventory"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician']}>
              <InventoryDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/catalog"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician']}>
              <PartCatalogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/catalog/new"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <AddPartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/catalog/:partId"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician']}>
              <PartDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/catalog/:partId/edit"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <EditPartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/requests"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician']}>
              <PartsRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/requests/:requestId"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician']}>
              <RequestDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/issue/:requestId"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'admin']}>
              <PhysicalIssuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/receive"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'admin']}>
              <ReceiveStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/movements"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <StockMovementLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/purchase-orders"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <PurchaseOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/purchase-orders/new"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <CreatePurchaseOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/purchase-orders/:poId"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <PurchaseOrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/import"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <ExcelImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/import/history"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <ImportHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/reports"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <InventoryReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/settings"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <InventorySettingsPage />
            </ProtectedRoute>
          }
        />
        {/* Training - /training redirects based on role */}
        <Route
          path="training"
          element={<Navigate to="/app/training/manage" replace />}
        />

        {/* Training - Trainee routes */}
        <Route
          path="training/my-modules"
          element={
            <ProtectedRoute requiredRoles={['trainee', 'floor_operator']}>
              <MyModulesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/my-modules/:assignmentId"
          element={
            <ProtectedRoute requiredRoles={['trainee', 'floor_operator']}>
              <ModuleLearningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/my-modules/:assignmentId/quiz"
          element={
            <ProtectedRoute requiredRoles={['trainee', 'floor_operator']}>
              <QuizPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/my-certificates"
          element={
            <ProtectedRoute requiredRoles={['trainee', 'floor_operator']}>
              <MyCertificatesPage />
            </ProtectedRoute>
          }
        />

        {/* Training - Management routes */}
        <Route
          path="training/manage"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TrainingDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/modules"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <ModuleLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/modules/new"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <CreateModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/modules/:moduleId"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <EditModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/modules/:moduleId/quiz"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <QuizBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/assignments"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <AssignmentsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/assign"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <AssignTrainingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/trainees/:userId"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TraineeProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/certificates"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <CertificatesManagerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/compliance"
          element={
            <ProtectedRoute requiredRoles={['plant_manager', 'admin', 'hr_officer']}>
              <ComplianceReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/content-library"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <ContentLibraryPage />
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

        {/* Triage history (inside AppLayout) */}
        <Route
          path="triage/history"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <TriageHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage/history/:sessionId"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <TriageSessionDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Triage builder (inside AppLayout) */}
        <Route
          path="triage-builder"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <TriageBuilderLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage-builder/new"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <TriageBuilderCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage-builder/templates"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <TriageBuilderTemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage-builder/:flowId"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <TriageBuilderFlowDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage-builder/:flowId/edit"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <TriageBuilderEditPage />
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
