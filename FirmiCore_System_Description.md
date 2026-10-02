# FirmiCore — Complete System Description (for Gemini / LLM knowledge upload)

FirmiCore (repository name: pulsemaint) is a multi-tenant CMMS (Computerized Maintenance Management System) for factories and plants. It manages machines, breakdowns, work orders, preventive maintenance, spare parts inventory, contractors, shift handovers, training, guided troubleshooting, machine effectiveness (MOE), continuous improvement (Kaizen), audits, safety, staff requests, reports and analytics, billing, and a platform-owner console.

## 1. Technology

- Frontend: React + TypeScript + Vite. State in Zustand stores. Validation with Zod. Path alias `@/*` = `src/*`. Entry point: `src/main.tsx` -> `src/App.tsx` -> `src/router/AppRouter.tsx`. (The Vue files `App.vue` / `main.js` are unused legacy.)
- Backend: Firebase (Auth, Firestore, Storage, Cloud Functions on Node 22). Stripe for billing. Nodemailer for email. Puppeteer + Chromium for server-side PDF. Google Sheets export (optional OAuth). AI through the Anthropic Claude API, called only from the `claudeJson` Cloud Function (key stored in Secret Manager).
- Multi-tenancy: every tenant document carries a `siteId` / `companyId`; Firestore rules (`firestore.rules`) and Storage rules (`storage.rules`) are the security boundary, not the client route guards.
- Languages: the UI uses i18n; the triage module is multilingual (English, Sinhala, Tamil, Bengali).
- Analytics are computed client-side from operational collections when pre-aggregated collections (`analytics_daily`, `analytics_monthly`, `machine_health`) are empty.

## 2. Users and Roles (9 tenant roles + platform superadmin)

| Role | Purpose |
|---|---|
| admin | Full control of the company: settings, billing, users, all modules |
| plant_manager | Plant leadership: broad operational + analytics access, same company-wide scope as admin |
| supervisor | Day-to-day maintenance/shift lead: creates work orders, signs off, edits PM |
| technician | Executes work orders, PM and breakdowns |
| store_keeper | Runs inventory, parts issue/receipt, purchase orders |
| hr_officer | Training, compliance, evaluations, contractor oversight |
| trainee | Employee in a 6-12 month training programme |
| floor_operator | Production machine operator; reports breakdowns, runs triage |
| safety_officer | EHS role: manager dashboard, safety cases, work permits, safety trainings; read access to operations, no repair actions |
| platform superadmin | Not a tenant role. Lumora Ventures staff, Firebase custom claim `superadmin: true`; uses the `/platform` console |

Access control: each route is guarded by `ProtectedRoute` with a `requiredRoles` list; the sidebar (`NAV_ITEMS`) is role-filtered. Machines have an explicit permission model (view / edit / delete / generate QR / decommission / view analytics).

## 3. Functional Modules (what each one does)

### 3.1 Authentication, Onboarding, Invitations
- Login, register, forgot password, email verification, invitation acceptance by token (`/invite/:token`), onboarding wizard, unauthorized page, subscription-ended page.
- Admins/HR/supervisors invite users by email (`sendInvitationEmail`). Contractors can be invited to jobs (`generateContractorInvitation`, `sendJobInvitation`).
- Public QR flows: `/scan` and `/report-breakdown` let someone scan a machine QR code and report a breakdown.

### 3.2 Role Dashboards (`/app/dashboard/*`)
Floor operator, supervisor, manager (admin / plant_manager / safety_officer), admin, technician, trainee, inventory (store keeper), training (HR). Each shows KPIs relevant to the role: breakdown kanban, machine health, technician performance, SLA summaries, inventory health, training compliance.

### 3.3 Machines (Asset Registry)
- List with search, filters, real-time updates.
- Multi-step Add Machine form (basic info, location, status/criticality, documents/photos, spare parts/notes), file upload, automatic QR code.
- Machine profile tabs: overview, documents/photos, breakdown history, maintenance history, analytics.
- Edit, QR page (download PNG/PDF, print, regenerate), decommission.
- Health score 0-100: starts at 100, deductions for breakdowns by severity and overdue PM in a trailing 90 days, credit for on-time PM.
- Cloud Functions: mark machine down when a breakdown is reported, reactivate when the breakdown closes or the WO is signed off; stamp plant on records.

### 3.4 Breakdowns
- Report (including via QR), acknowledge, assign, attend, resolve, close, edit.
- Kanban board by status, severity, type, root cause; notification log (push / SMS / email / in-app); optional WhatsApp.
- Auto-launches a triage flow when a ticket is created (`autoLaunchTriage`), escalation notifications (`notifyTriageEscalation`), triage report PDF and attach-to-breakdown functions.

### 3.5 Work Orders
- Lifecycle: DRAFT -> OPEN -> ASSIGNED -> IN_PROGRESS -> ON_HOLD (parts/approval) -> COMPLETED -> SIGNED_OFF -> CLOSED / CANCELLED.
- Multi-technician checklists with measurements, time segments (travel/waiting/working), parts requests, root-cause capture, contractor-type work orders (project cost, total cost, 4-dimension contractor rating at sign-off).
- "My Work Orders" personal task view. Sign-Off Queue (supervisor / manager / admin) with two tabs: Work Orders and Trainings (practical assessments). A plant manager cannot sign off what they created.
- Cloud Functions: `onWOCreated`, `onWOUpdated`, `onWOSignedOff`, `onPartsRequestCreated`, `slaBreachCheck` (every 5 minutes), `stampWorkOrderPlant`.

### 3.6 Maintenance History
For plant managers / admin: all signed-off work orders and closed breakdowns of the plant, filter by department, supervisor, date, type; per-record PDF export (summary, team, checklist, work logs, parts and cost, sign-off, AI root cause, status history, photos).

### 3.7 Preventive Maintenance (PM)
- Schedules: calendar-based or meter-based (operating hours / production cycles); create, view, edit.
- PM calendar and compliance dashboard (monthly trend, per machine, per technician, workload).
- Cloud Functions: `schedulePmCheck`, `checkPmOverdue`, `updatePmComplianceOnWoClose`, `triggerManualPM`.

### 3.8 Inventory and Parts
- Parts catalog (electrical, mechanical, hydraulic, pneumatic, automation, civil, custom), stock status, minimum levels.
- Multi-stage parts-request approval (store keeper -> supervisor ...), reservation, manual issue, receiving, returns, movement log.
- Purchase orders (create, edit, email to suppliers), supplier management, Excel import with import history and reversal, inventory reports and settings.
- Cloud Functions: `processPartsRequest`, `reserveStock`, `confirmPartsIssue`, `confirmPartsReturn`, `notifyLowStock`, `processExcelImport`, `reverseImport`, `autoUpdateWoPartsOnClose`, `sendPoEmails`.

### 3.9 Contractors
- Registry, contractor technicians, documents with validity/expiry tracking, compliance, performance dashboard, history, analytics, reports.
- Jobs: create, invite contractor, log work, sign-off, invoice comparison with variance alerts, rate contractor.
- Cloud Functions: `createContractorJob`, `sendJobInvitation`, `updateDocumentValidityStatus`, `recalculateContractorMetrics*`, `updateMachineHistoryOnJobClose`, `generateContractorReport`, `notifyInvoiceVariance`.

### 3.10 Shift Management and Handover
- My Shift for everyone; Shift Config (shift plans, admin / plant manager) with plant and department setup.
- Shift handover: create, briefing, history, detail, accept; automatic shift summary (pending WOs, ongoing breakdowns, low stock, watch flags); watch flags carried forward and auto-resolved when the ticket closes; reminders for shift start; alerts for unaccepted handovers.
- Cloud Functions: `autoCompileShiftSummary`, `submitHandover`, `acceptHandover`, `checkUnacceptedHandovers`, `carryForwardWatchFlags`, `resolveWatchFlagOnTicketClose`, `resolveWatchFlagOnBreakdownClose`, `onShiftPlanUpdated`, `onHandoverSubmitted`, `sendShiftStartReminders`.

### 3.11 Training
- Learner side: My Modules, quizzes, My Certificates, My Program (trainees), knowledge write-up, weekend summary.
- Management side: dashboard, two separate module libraries (Training workforce modules and Trainee Management programme modules, told apart by `libraryScope`), module editor, quiz builder, assign training (users / roles / departments), assignment tracking, trainee profiles and programmes, certificates manager, compliance report, content library, safety trainings (session scheduling).
- 6-12 month trainee programme with supervisor-reviewed weekend self-reports. Practical assessment sign-off issues an A4 certificate on company letterhead (client-side).
- Cloud Functions: `generateTrainingCertificate`, `checkRetrainingTrigger`, `sendTrainingReminders`, `generateComplianceReportPdf`, `notifyPracticalSignOffRequired`, offboard training functions (`onOffboardTrainingAssigned/Completed`, `checkOverdueOffboardReports`).

### 3.12 Triage (Guided Troubleshooting)
- Branching decision trees for safe response to a breakdown, in 4 languages, categorized by phase (safety, assessment, safe action, document, wait) and danger level; session runner, completion screen, history.
- Triage Builder: author flows and templates (supervisor / manager / admin / HR).
- Flow is resolved per machine or machine type (`triageFlowResolver`).

### 3.13 MOE (Machine Overall Effectiveness) and OEE
- MOE score per machine = weighted mix of availability (35%), maintenance compliance (25%), reliability (25%) and health (15%); status bands excellent >= 85, good >= 70, at risk >= 50, critical threshold 70.
- Daily snapshots and recalculation on breakdown, PM or work-order change; aggregates callable; backfill tool.
- Cloud Functions: `calculateDailyMoeSnapshots`, `recalculateMoeOn*Change`, `processMoeRecalcQueue`, `getMoeAggregates`, `backfillMoeSnapshots`.

### 3.14 Kaizen
Continuous-improvement idea board: submit, review and track improvement ideas.

### 3.15 Audit and Evaluations
- Unified audit tool covering TPM, 5S, OEE and contractor audits; AI-assisted root cause for audit findings.
- Evaluations: staff/contractor evaluation forms and a form builder.
- (The older `tpm` and `fives` modules are built but not routed; the `audit` module supersedes them.)

### 3.16 Safety
- Safety cases (incident, near-miss, hazard, unsafe act): any company member can report; safety officer / supervisors / managers triage and close.
- Work permits (Permit-to-Work) with categories, precautions, extension, overdue alerts and sign-off.
- Safety calendar, safety blacklist, safety trainings. Legacy Safety Dashboard / Analytics pages still routable but superseded by the Manager Dashboard and Analytics "Safety" tab.

### 3.17 Staff Requests
- Every role except admin raises requests (personal, work, service letter, access to past WO/breakdown details, other) with attachments, routed to supervisors, plant managers or admin.
- Requests Inbox for handlers: reply, close, reopen; follow-ups by the requester; closed requests hidden after 7 days (plant managers keep the full history).
- Record access grants: a plant manager or admin shares chosen work orders/breakdowns as time-limited read-only snapshots (`record_access_grants`), revocable, auto-purged by `purgeExpiredRecordGrants` every 15 minutes. Callables: `listRequestRecipients`, `listRecordReferences`.

### 3.18 Reports and Analytics
- Reports hub with history; push to Google Sheets or CSV fallback; PDF reports generated server-side (`generateReport`, `generateScheduledReport`, `cleanupOldReports`).
- Report types: breakdown summary, work order detail, machine history, machine health score, maintenance cost, technician performance, contractor performance, contractor invoice comparison, inventory usage, parts consumption, low stock alert, PM compliance, training compliance, downtime analysis, SLA compliance, audit trail, safety near-miss, shift handover summary, executive monthly.
- Analytics page: cross-module KPIs (machine health, technician and contractor performance, SLA, inventory health, training compliance, heatmaps, Safety tab). Scheduled analytics: `generateDailyAnalytics`, `generateMonthlyAnalytics`, `updateMachineHealth`, `updateTechnicianStatus`, `recalculateMtbf`, `recalculateMttr`, `metricsDaily`.

### 3.19 Notifications
One notification path (`notifications.service`); strict role targeting; admin and plant manager are copied on everything with attribution ("Name (Role) did X"); the bell is a to-do list with per-user read state and Mark all as read.

### 3.20 AI Features
- `claudeJson` Cloud Function powers root-cause suggestions (breakdowns, audits) and translation; can be disabled with `VITE_DISABLE_AI`.

### 3.21 Settings, Users, Plants, Billing, Help, Support
- Settings (admin), User Management (admin / supervisor / manager / HR), Plants and Departments management.
- Billing and Plan (admin): Stripe Checkout, customer portal, card setup, payment method update, billing overview, trial-expiry banner, terms version acceptance (`createCheckoutSession`, `createPortalSession`, `stripeWebhook`, `createCardSetup`, `finalizeCardSetup`, `getBillingOverview`, `updatePaymentMethod`).
- Help and Support page; Support Requests: company admins message Lumora staff (`supportRequests` with message threads; notification triggers on create, message and status change).

### 3.22 Platform Superadmin Console (`/platform`, Lumora staff only)
Overview, companies list and detail (edit plan/status), payments, payment reminders and daily billing digest, user login management, support requests inbox, audit log (`platformAuditLog`). Only verified emails in `PLATFORM_SUPERADMIN_EMAILS` can claim access (`platformClaimSuperadmin`).

## 4. Role-to-Feature Summary

| Module | admin | plant_manager | supervisor | technician | store_keeper | hr_officer | trainee | floor_operator | safety_officer |
|---|---|---|---|---|---|---|---|---|---|
| Machines | full | full | edit | view | - | - | view | - | view |
| Breakdowns | full | full | full | full | - | - | report/view | report | view |
| Work Orders | full | full | full | own tasks | - | - | own tasks | - | view |
| PM | full | full | full | view | - | - | - | - | view |
| Inventory | full | full | full | view | full | - | view | - | view |
| Contractors | full | full | full | - | - | view | - | - | view |
| Reports / Analytics | full | full | full | - | - | reports | - | - | view |
| Shift Handover | full | view | full | - | - | view | - | - | view |
| Training management | full | full | view | - | - | full | - | - | view |
| Triage | all roles | | | | | | | | |
| Triage Builder | full | full | full | - | - | full | - | - | view |
| MOE/OEE | full | full | full | - | - | - | - | - | - |
| Kaizen | full | full | full | full | full | full | - | - | view |
| Audit | full | full | full | - | - | full | - | - | view |
| Safety cases / permits | full | full | full | report | report | report | report | report | full |
| Settings / Billing | admin only | | | | | | | | |
| Staff Requests | inbox | raise + inbox | raise + inbox | raise | raise | raise | raise | raise | raise |

## 5. Data Model (main Firestore collections)
users, companies, plants, departments, machines, breakdown_tickets, workOrders (+ partsRequests subcollection), pmSchedules / PM history, parts, partsRequests, purchaseOrders, suppliers, stock movements, contractors, contractorJobs, handovers, shift plans/sessions, trainingModules, trainingAssignments, certificates, triage flows and triageSessions, moe snapshots, kaizen ideas, audits, evaluations, safety_cases, work_permits, staff_requests, record_access_grants, reports, notifications, analytics_daily, analytics_monthly, machine_health, supportRequests (+ messages), platformAuditLog.

## 6. Known Gaps
1. Role naming drift: an older doc says `maintenance_supervisor`; code uses `supervisor`.
2. `tpm` and `fives` modules are orphaned (built, not routed).
3. Nav and route access can drift for some roles (e.g. Evaluations for supervisors).
4. `UserRole` is declared in both `src/types/auth.ts` and `src/types/breakdown.ts`.
