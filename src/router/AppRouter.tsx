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
import MyProgramPage from '../pages/training/MyProgramPage';
import KnowledgeWriteupPage from '../pages/training/KnowledgeWriteupPage';

// Training pages - Management
import TrainingDashboardPage from '../pages/training/manage/TrainingDashboardPage';
import ModuleLibraryPage from '../pages/training/manage/ModuleLibraryPage';
import CreateModulePage from '../pages/training/manage/CreateModulePage';
import EditModulePage from '../pages/training/manage/EditModulePage';
import CreateTraineeModulePage from '../pages/training/manage/CreateTraineeModulePage';
import EditTraineeModulePage from '../pages/training/manage/EditTraineeModulePage';
import QuizBuilderPage from '../pages/training/manage/QuizBuilderPage';
import AssignTrainingPage from '../pages/training/manage/AssignTrainingPage';
import AssignmentsListPage from '../pages/training/manage/AssignmentsListPage';
import TraineeProfilePage from '../pages/training/manage/TraineeProfilePage';
import TraineeProgrammePage from '../pages/training/manage/TraineeProgrammePage';
import CertificatesManagerPage from '../pages/training/manage/CertificatesManagerPage';
import ComplianceReportPage from '../pages/training/manage/ComplianceReportPage';
import SafetyTrainingsPage from '../pages/training/manage/SafetyTrainingsPage';
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

// Triage pages (flow runner — legacy)
import TriageRunnerPage from '../pages/triage/TriageRunnerPage';
import TriageCompletePage from '../pages/triage/TriageCompletePage';
import TriageHistoryPage from '../pages/triage/TriageHistoryPage';
import TriageSessionDetailPage from '../pages/triage/TriageSessionDetailPage';
import TriageBuilderCreatePage from '../pages/triage-builder/TriageBuilderCreatePage';
import TriageBuilderEditPage from '../pages/triage-builder/TriageBuilderEditPage';
import TriageBuilderFlowDetailPage from '../pages/triage-builder/TriageBuilderFlowDetailPage';
import TriageBuilderTemplatesPage from '../pages/triage-builder/TriageBuilderTemplatesPage';

// Triage (new modules)
import TriageKnowledgePage from '../features/triage/TriagePage';
import TriageKnowledgeBuilderPage from '../features/triage/TriageBuilderPage';

// PM pages
import {
  PMSchedulesPage,
  PMScheduleEditPage,
  PMScheduleDetailPage,
  PMCalendarPage,
} from '../pages/pm';

// Inventory pages
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
import EditPurchaseOrderPage from '../pages/inventory/EditPurchaseOrderPage';
import ExcelImportPage from '../pages/inventory/ExcelImportPage';
import ImportHistoryPage from '../pages/inventory/ImportHistoryPage';
import InventoryReportsPage from '../pages/inventory/InventoryReportsPage';
import InventorySettingsPage from '../pages/inventory/InventorySettingsPage';
import SuppliersPage from '../pages/inventory/SuppliersPage';
import ManualIssuePage from '../pages/inventory/ManualIssuePage';
import PartReturnsPage from '../pages/inventory/PartReturnsPage';

// Safety (EHS)
import SafetyDashboard from '../modules/safety/pages/SafetyDashboard';
import WorkPermitsPage from '../modules/safety/pages/WorkPermitsPage';
import SafetyCalendarPage from '../modules/safety/pages/SafetyCalendarPage';
import SafetyAnalyticsPage from '../modules/safety/pages/SafetyAnalyticsPage';
import SafetyCasesPage from '../modules/safety/pages/SafetyCasesPage';

// Dashboard
import {
  DashboardPage,
  SupervisorDashboard,
  ManagerDashboard,
  TechnicianDashboard,
  TraineeDashboard,
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
import MyShiftPage from '../pages/shift/MyShiftPage';
import ShiftBriefingPage from '../pages/handover/ShiftBriefingPage';
import HandoverHistoryPage from '../pages/handover/HandoverHistoryPage';
import HandoverDetailPage from '../pages/handover/HandoverDetailPage';
import ShiftConfigPage from '../pages/settings/ShiftConfigPage';
import MainReportsHubPage from '../pages/reports/ReportsHubPage';
import ReportHistoryPage from '../pages/reports/ReportHistoryPage';

// Billing
import BillingPage from '../pages/billing/BillingPage';

// Real pages (Module 1, 2, 4, 11)
import ReportBreakdownPage from '../pages/breakdowns/ReportBreakdownPage';
import PublicBreakdownReportPage from '../pages/breakdowns/PublicBreakdownReportPage';
import BreakdownsPage from '../pages/breakdowns/BreakdownsPage';
import BreakdownGroupPage from '../pages/breakdowns/BreakdownGroupPage';
import ViewBreakdownPage from '../pages/breakdowns/ViewBreakdownPage';
import EditBreakdownPage from '../pages/breakdowns/EditBreakdownPage';
import AttendBreakdownsPage from '../pages/breakdowns/AttendBreakdownsPage';
import AnalyticsPage from '../pages/analytics/AnalyticsPage';
import WorkOrdersPage from '../pages/workorders/WorkOrdersPage';
import MyWorkOrdersPage from '../pages/workorders/MyWorkOrdersPage';
import SettingsPage from '../pages/settings/SettingsPage';
import UsersPage from '../pages/settings/UsersPage';

// Module 16 — MOE (Machine Overall Effectiveness)
import { MoePage } from '../modules/moe/pages/MoePage';

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
      {/* Public, no-login breakdown reporting — reached by scanning a machine's QR code */}
      <Route path="/report-breakdown" element={<PublicBreakdownReportPage />} />

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
          <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
            <TriageRunnerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/triage/:sessionId/complete"
        element={
          <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
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
            <ProtectedRoute requiredRoles={['plant_manager', 'admin', 'supervisor', 'technician', 'store_keeper', 'hr_officer', 'trainee', 'safety_officer']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/supervisor"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/manager"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'plant_manager', 'admin']}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/technician"
          element={
            <ProtectedRoute requiredRoles={['technician', 'plant_manager', 'admin']}>
              <TechnicianDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/trainee"
          element={
            <ProtectedRoute requiredRoles={['trainee', 'admin']}>
              <TraineeDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/inventory"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'plant_manager', 'admin']}>
              <InventoryDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard/training"
          element={
            <ProtectedRoute requiredRoles={['hr_officer', 'plant_manager', 'admin']}>
              <TrainingDashboard />
            </ProtectedRoute>
          }
        />

        {/* Machines */}
        <Route
          path="machines"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'technician', 'trainee']}>
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
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'technician', 'trainee']}>
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
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'technician', 'trainee']}>
              <MachineQrPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="breakdowns"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin', 'trainee']}>
              <BreakdownsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="breakdowns/report"
          element={
            <ProtectedRoute requiredRoles={['floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin', 'trainee']}>
              <ReportBreakdownPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="breakdowns/group"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin', 'trainee']}>
              <BreakdownGroupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="breakdowns/:id"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin', 'trainee']}>
              <ViewBreakdownPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="breakdowns/:id/edit"
          element={
            <ProtectedRoute requiredRoles={['floor_operator', 'technician', 'trainee', 'supervisor', 'plant_manager', 'admin']}>
              <EditBreakdownPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="breakdowns/attend"
          element={
            <ProtectedRoute requiredRoles={['technician', 'trainee', 'supervisor', 'plant_manager', 'admin']}>
              <AttendBreakdownsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="work-orders"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'technician', 'supervisor', 'plant_manager', 'admin']}>
              <WorkOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-work-orders"
          element={
            <ProtectedRoute requiredRoles={['technician', 'admin', 'trainee', 'supervisor', 'plant_manager']}>
              <MyWorkOrdersPage />
            </ProtectedRoute>
          }
        />
        {/* Inventory — the old mixed-everything dashboard is replaced by three
            focused tabs (Inventory catalog / PO / Requests) in the sidebar;
            redirect any stale link to the catalog instead of that page. */}
        <Route path="inventory" element={<Navigate to="/app/inventory/catalog" replace />} />
        <Route
          path="inventory/catalog"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician', 'trainee']}>
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
            <ProtectedRoute requiredRoles={['safety_officer', 'store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician', 'trainee']}>
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
            <ProtectedRoute requiredRoles={['safety_officer', 'store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician', 'trainee']}>
              <PartsRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/requests/:requestId"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'store_keeper', 'supervisor', 'plant_manager', 'admin', 'technician', 'trainee']}>
              <RequestDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/issue/:requestId"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <PhysicalIssuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/receive"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
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
          path="inventory/purchase-orders/:poId/edit"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <EditPurchaseOrderPage />
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
        <Route
          path="inventory/suppliers"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <SuppliersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="inventory/issue/manual"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <ManualIssuePage />
            </ProtectedRoute>
          }
        />
        {/* Safety (EHS) — safety officer workspace, with manager oversight */}
        <Route path="safety" element={<Navigate to="/app/safety/dashboard" replace />} />
        <Route path="safety/dashboard" element={<ProtectedRoute requiredRoles={['safety_officer']}><SafetyDashboard /></ProtectedRoute>} />
        <Route path="safety/cases" element={<ProtectedRoute requiredRoles={['safety_officer', 'admin', 'plant_manager', 'supervisor', 'technician', 'floor_operator', 'store_keeper', 'trainee']}><SafetyCasesPage /></ProtectedRoute>} />
        <Route path="safety/permits" element={<ProtectedRoute requiredRoles={['safety_officer', 'admin', 'plant_manager', 'supervisor']}><WorkPermitsPage /></ProtectedRoute>} />
        {/* Safety Training Schedules — the company-wide safety-training
            calendar, available to every signed-in role. */}
        <Route path="safety/calendar" element={<ProtectedRoute><SafetyCalendarPage /></ProtectedRoute>} />
        <Route path="safety/analytics" element={<ProtectedRoute requiredRoles={['safety_officer']}><SafetyAnalyticsPage /></ProtectedRoute>} />

        <Route
          path="inventory/returns"
          element={
            <ProtectedRoute requiredRoles={['store_keeper', 'supervisor', 'plant_manager', 'admin']}>
              <PartReturnsPage />
            </ProtectedRoute>
          }
        />
        {/* Training - /training redirects based on role */}

        {/* Contractors */}
        <Route path="contractors" element={<ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}><ContractorRegistryPage /></ProtectedRoute>} />
        <Route path="contractors/new" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><AddContractorPage /></ProtectedRoute>} />
        <Route path="contractors/performance" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}><PerformanceDashboardPage /></ProtectedRoute>} />
        <Route path="contractors/compliance" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><CompliancePage /></ProtectedRoute>} />
        <Route path="contractors/reports" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}><ReportsHubPage /></ProtectedRoute>} />
        <Route path="contractors/jobs" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><ContractorJobsListPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><ContractorJobDetailPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId/log-work" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><LogWorkPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId/sign-off" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><SignOffPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId/invoice" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><InvoiceComparisonPage /></ProtectedRoute>} />
        <Route path="contractors/jobs/:jobId/rate" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><RateContractorPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}><ContractorProfilePage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/edit" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><EditContractorPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/documents" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><ContractorDocumentsPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/technicians" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><ContractorTechniciansPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/technicians/new" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><AddTechnicianPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/technicians/:techId/edit" element={<ProtectedRoute requiredRoles={['hr_officer', 'supervisor', 'plant_manager', 'admin']}><EditTechnicianPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/history" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}><ContractorHistoryPage /></ProtectedRoute>} />
        <Route path="contractors/:contractorId/analytics" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'hr_officer']}><ContractorAnalyticsPage /></ProtectedRoute>} />

        {/* Shift handover */}
        <Route path="shift/my" element={<ProtectedRoute><MyShiftPage /></ProtectedRoute>} />
        <Route path="shift/handover/create" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><HandoverCreatePage /></ProtectedRoute>} />
        <Route path="shift/handover/briefing" element={<ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}><ShiftBriefingPage /></ProtectedRoute>} />
        <Route path="shift/handover/history" element={<ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}><HandoverHistoryPage /></ProtectedRoute>} />
        <Route path="shift/handover/:id" element={<ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}><HandoverDetailPage /></ProtectedRoute>} />
        <Route path="settings/shifts" element={<ProtectedRoute requiredRoles={['hr_officer', 'plant_manager', 'admin']}><ShiftConfigPage /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'hr_officer', 'admin', 'store_keeper']}><MainReportsHubPage /></ProtectedRoute>} />
        <Route path="reports/history" element={<ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'hr_officer', 'admin', 'store_keeper']}><ReportHistoryPage /></ProtectedRoute>} />
        <Route
          path="training"
          element={<Navigate to="/app/training/manage/modules" replace />}
        />

        {/* Training - Learner routes. Training can be assigned to ANY role
            (technicians, supervisors, …), so every signed-in user can open
            their own assigned trainings — not just trainee/floor_operator. */}
        <Route
          path="training/my-modules"
          element={
            <ProtectedRoute>
              <MyModulesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/my-modules/:assignmentId"
          element={
            <ProtectedRoute>
              <ModuleLearningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/my-modules/:assignmentId/quiz"
          element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/my-certificates"
          element={
            <ProtectedRoute>
              <MyCertificatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/my-program"
          element={
            <ProtectedRoute requiredRoles={['trainee', 'admin']}>
              <MyProgramPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/knowledge-writeup"
          element={
            <ProtectedRoute requiredRoles={['trainee', 'admin']}>
              <KnowledgeWriteupPage />
            </ProtectedRoute>
          }
        />

        {/* Training - Management routes */}
        <Route
          path="training/manage"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TrainingDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/modules"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <ModuleLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/modules/new"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'plant_manager', 'admin', 'hr_officer', 'supervisor']}>
              <CreateModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/modules/:moduleId"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'plant_manager', 'admin', 'hr_officer', 'supervisor']}>
              <EditModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/modules/:moduleId/quiz"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'plant_manager', 'admin', 'hr_officer', 'supervisor']}>
              <QuizBuilderPage />
            </ProtectedRoute>
          }
        />
        {/* Trainee Management's module library has its own editor routes, so
            the two libraries no longer share one editor switched by a query
            param. Same requiredRoles as the Training library's editor routes.
            The index redirects to Trainee Management, which is where the
            trainee library lives. */}
        <Route
          path="training/manage/trainee-modules"
          element={<Navigate to="/app/training/manage/assignments" replace />}
        />
        <Route
          path="training/manage/trainee-modules/new"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'plant_manager', 'admin', 'hr_officer', 'supervisor']}>
              <CreateTraineeModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/trainee-modules/:moduleId"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'plant_manager', 'admin', 'hr_officer', 'supervisor']}>
              <EditTraineeModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/trainee-modules/:moduleId/quiz"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'plant_manager', 'admin', 'hr_officer', 'supervisor']}>
              <QuizBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/assignments"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <AssignmentsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/assign"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <AssignTrainingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/trainees/:userId"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TraineeProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/trainees/:userId/programme"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TraineeProgrammePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/certificates"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <CertificatesManagerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage/safety-trainings"
          element={
            <ProtectedRoute requiredRoles={['admin', 'plant_manager']}>
              <SafetyTrainingsPage />
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
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <ContentLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            // Union of the roles that used to reach Users/Shifts via their
            // own top-level nav items, now folded into Settings.
            <ProtectedRoute requiredRoles={['admin', 'supervisor', 'plant_manager', 'hr_officer']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="billing"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <BillingPage />
            </ProtectedRoute>
          }
        />
        {/* PM Schedules */}
        <Route
          path="pm-schedules"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'technician']}>
              <PMSchedulesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm-schedules/:id"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'technician']}>
              <PMScheduleDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm-schedules/:id/edit"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <PMScheduleEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm-calendar"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin', 'technician']}>
              <PMCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'plant_manager', 'admin', 'supervisor']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="settings/users"
          element={
            <ProtectedRoute requiredRoles={['admin', 'supervisor', 'plant_manager', 'hr_officer']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        {/* MOE (Machine Overall Effectiveness) — Module 16 */}
        <Route
          path="moe"
          element={
            <ProtectedRoute requiredRoles={['supervisor', 'plant_manager', 'admin']}>
              <MoePage />
            </ProtectedRoute>
          }
        />

        {/* Kaizen — Module 18 */}
        <Route
          path="kaizen"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'technician', 'store_keeper', 'supervisor', 'plant_manager', 'hr_officer', 'admin']}>
              <KaizenPage />
            </ProtectedRoute>
          }
        />

        {/* Audit — unified TPM/5S/OEE/Contractor. Not available to
            technician, trainee, floor_operator, or store_keeper roles. */}
        <Route
          path="audit"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <AuditPage />
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

        {/* Triage (new) */}
        <Route
          path="triage"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'floor_operator', 'technician', 'supervisor', 'plant_manager', 'admin', 'hr_officer', 'store_keeper', 'trainee']}>
              <TriageKnowledgePage />
            </ProtectedRoute>
          }
        />

        {/* Triage flow runner history (legacy, inside AppLayout) */}
        <Route
          path="triage/history"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TriageHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage/history/:sessionId"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'technician', 'hr_officer']}>
              <TriageSessionDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Triage builder (inside AppLayout) */}
        <Route
          path="triage-builder"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TriageKnowledgeBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage-builder/new"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TriageBuilderCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage-builder/templates"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TriageBuilderTemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage-builder/:flowId"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
              <TriageBuilderFlowDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="triage-builder/:flowId/edit"
          element={
            <ProtectedRoute requiredRoles={['safety_officer', 'supervisor', 'plant_manager', 'admin', 'hr_officer']}>
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
