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

// Scan redirect
import ScanRedirectPage from '../pages/machines/ScanRedirectPage';

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

// PM pages
import {
  PMSchedulesPage,
  PMScheduleCreatePage,
  PMScheduleEditPage,
  PMScheduleDetailPage,
  PMCalendarPage,
  PMCompliancePage,
} from '../pages/pm';

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

// Dashboard
import {
  DashboardPage,
  SupervisorDashboard,
  ManagerDashboard,
  TechnicianDashboard,
  InventoryDashboard,
  TrainingDashboard,
} from '../pages/dashboard';

// Contractor pages
import ContractorRegistryPage from '../pages/contractors/ContractorRegistryPage';
import AddContractorPage from '../pages/contractors/AddContractorPage';
import ContractorProfilePage from '../pages/contractors/ContractorProfilePage';
import EditContractorPage from '../pages/contractors/EditContractorPage';
import ContractorDocumentsPage from '../pages/contractors/ContractorDocumentsPage';
import ContractorTechniciansPage from '../pages/contractors/ContractorTechniciansPage';
import AddTechnicianPage from '../pages/contractors/AddTechnicianPage';
import EditTechnicianPage from '../pages/contractors/EditTechnicianPage';
import ContractorHistoryPage from '../pages/contractors/ContractorHistoryPage';
import ContractorAnalyticsPage from '../pages/contractors/ContractorAnalyticsPage';
import ContractorJobsListPage from '../pages/contractors/jobs/ContractorJobsListPage';
import ContractorJobDetailPage from '../pages/contractors/jobs/ContractorJobDetailPage';
import LogWorkPage from '../pages/contractors/jobs/LogWorkPage';
import SignOffPage from '../pages/contractors/jobs/SignOffPage';
import InvoiceComparisonPage from '../pages/contractors/jobs/InvoiceComparisonPage';
import RateContractorPage from '../pages/contractors/jobs/RateContractorPage';
import PerformanceDashboardPage from '../pages/contractors/PerformanceDashboardPage';
import CompliancePage from '../pages/contractors/CompliancePage';
import ReportsHubPage from '../pages/contractors/ReportsHubPage';
import HandoverCreatePage from '../pages/handover/HandoverCreatePage';
import ShiftBriefingPage from '../pages/handover/ShiftBriefingPage';
import HandoverHistoryPage from '../pages/handover/HandoverHistoryPage';
import HandoverDetailPage from '../pages/handover/HandoverDetailPage';
import ShiftConfigPage from '../pages/settings/ShiftConfigPage';
import MainReportsHubPage from '../pages/reports/ReportsHubPage';
import ReportHistoryPage from '../pages/reports/ReportHistoryPage';

// Real pages (Module 1, 2, 4, 11)
import ReportBreakdownPage from '../pages/breakdowns/ReportBreakdownPage';
import BreakdownsPage from '../pages/breakdowns/BreakdownsPage';
import ViewBreakdownPage from '../pages/breakdowns/ViewBreakdownPage';
import EditBreakdownPage from '../pages/breakdowns/EditBreakdownPage';
import AnalyticsPage from '../pages/analytics/AnalyticsPage';
import WorkOrdersPage from '../pages/workorders/WorkOrdersPage';
import SettingsPage from '../pages/settings/SettingsPage';
import UsersPage from '../pages/settings/UsersPage';

// Module 16 — OEE
import { OEEPage } from '../modules/oee/pages/OEEPage';

// TPM Module
import { TPMPage } from '../modules/tpm/pages/TPMPage';
import { FiveSPage } from '../modules/fives/pages/FiveSPage';

// Module 18 — Kaizen
import { KaizenPage } from '../modules/kaizen/pages/KaizenPage';

// Audit Module — unified TPM / 5S / OEE / Contractor audits
import { AuditPage } from '../modules/audit/pages/AuditPage';

// Evaluations Module
import EvaluationsPage from '../modules/evaluation/pages/EvaluationsPage';

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
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/scan" element={<ScanRedirectPage />} />

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

        {/* Dashboard — role-based redirect + sub-dashboards */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute requiredRoles={['plant_manager', 'admin', 'supervisor', 'technician', 'store_keeper', 'hr_officer']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/supervisor"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/manager"
          element={
            <ProtectedRoute requiredRoles={['plant_manager', 'admin']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/technician"
          element={
            <ProtectedRoute requiredRoles={['technician', 'admin']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/inventory"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'admin']}>
              <InventoryDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/training"
          element={
            <ProtectedRoute requiredRoles={['hr_officer', 'admin']}>
              <TrainingDashboard />
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
            <ProtectedRoute requiredRoles={['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin']}>
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
          path="breakdowns/:id"
          element={
            <ProtectedRoute requiredRoles={['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin']}>
              <ViewBreakdownPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="breakdowns/:id/edit"
          element={
            <ProtectedRoute requiredRoles={['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin']}>
              <EditBreakdownPage />
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

        {/* Contractors */}
        <Route path="contractors" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ContractorRegistryPage /></ProtectedRoute>} />
        <Route path="contractors/new" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><AddContractorPage /></ProtectedRoute>} />
        <Route path="contractors/performance" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><PerformanceDashboardPage /></ProtectedRoute>} />
        <Route path="contractors/compliance" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><CompliancePage /></ProtectedRoute>} />
        <Route path="contractors/reports" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ReportsHubPage /></ProtectedRoute>} />
        <Route path="contractors/jobs" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ContractorJobsListPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ContractorJobDetailPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId/log-work" element={<ProtectedRoute requiredRoles={['supervisor', 'admin']}><LogWorkPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId/sign-off" element={<ProtectedRoute requiredRoles={['supervisor', 'admin']}><SignOffPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId/invoice" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><InvoiceComparisonPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId/rate" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><RateContractorPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ContractorProfilePage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/edit" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><EditContractorPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/documents" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><ContractorDocumentsPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/technicians" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ContractorTechniciansPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/technicians/new" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><AddTechnicianPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/technicians/:techId/edit" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><EditTechnicianPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/history" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ContractorHistoryPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/analytics" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ContractorAnalyticsPage /></ProtectedRoute>} />

        {/* Shift handover */}
        <Route path="shift/handover/create" element={<ProtectedRoute requiredRoles={['supervisor', 'admin']}><HandoverCreatePage /></ProtectedRoute>} />
        <Route path="shift/handover/briefing" element={<ProtectedRoute requiredRoles={['supervisor', 'admin']}><ShiftBriefingPage /></ProtectedRoute>} />
        <Route path="shift/handover/history" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}><HandoverHistoryPage /></ProtectedRoute>} />
        <Route path="shift/handover/:id" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}><HandoverDetailPage /></ProtectedRoute>} />
        <Route path="settings/shifts" element={<ProtectedRoute requiredRoles={['admin']}><ShiftConfigPage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'store_keeper', 'hr_officer', 'admin']}><MainReportsHubPage /></ProtectedRoute>} />
        <Route path="reports/history" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'store_keeper', 'hr_officer', 'admin']}><ReportHistoryPage /></ProtectedRoute>} />
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
        {/* PM Schedules */}
        <Route
          path="pm-schedules"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <PMSchedulesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm-schedules/create"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <PMScheduleCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm-schedules/:id"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <PMScheduleDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm-schedules/:id/edit"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <PMScheduleEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm-calendar"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <PMCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute requiredRoles={['plant_manager', 'admin', 'supervisor']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm-compliance"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <PMCompliancePage />
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

        {/* OEE — Module 16 */}
        <Route
          path="oee"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <OEEPage />
            </ProtectedRoute>
          }
        />

        {/* TPM */}
        <Route
          path="tpm"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <TPMPage />
            </ProtectedRoute>
          }
        />

        {/* Kaizen — Module 18 */}
        <Route
          path="kaizen"
          element={
            <ProtectedRoute requiredRoles={['technician', 'store_keeper', 'supervisor', 'plant_manager', 'hr_officer', 'admin']}>
              <KaizenPage />
            </ProtectedRoute>
          }
        />

        {/* Audit — unified TPM/5S/OEE/Contractor */}
        <Route
          path="audit"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <AuditPage />
            </ProtectedRoute>
          }
        />

        {/* 5S Audit */}
        <Route
          path="fives"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <FiveSPage />
            </ProtectedRoute>
          }
        />

        {/* Evaluations */}
        <Route
          path="evaluations"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <EvaluationsPage />
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
      <Route path="/reports" element={<Navigate to="/app/reports" replace />} />
      <Route path="/reports/history" element={<Navigate to="/app/reports/history" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
