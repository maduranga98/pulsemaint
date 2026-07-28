# PulseMaint — Features & Role-Based Access Guide

PulseMaint is a multi-tenant maintenance management platform (React + TypeScript + Vite + Firebase). Access to every route is enforced by role, and the sidebar navigation mirrors those restrictions. This document lists every feature module, its purpose, and exactly which roles can use it.

> **Note:** The repo also contains a legacy/unused Vue scaffold (`App.vue`, `main.js`, generic `README.md` boilerplate) — this is not the active app. The real application entry point is `src/main.tsx` → `src/App.tsx` → `src/router/AppRouter.tsx`.

---

## 1. User Roles

PulseMaint has **8 roles**, stored on the user's Firestore profile (`users/{uid}.role`) and enforced via `ProtectedRoute`/`requiredRoles` on every route.

| Role (code value) | Description |
|---|---|
| `admin` | System administrator — full access to everything, including settings & billing |
| `plant_manager` | Plant/site management — broad operational + analytics access |
| `supervisor` | Maintenance/shift supervisor — day-to-day operational lead |
| `technician` | Maintenance technician — executes work orders, PM, breakdowns |
| `store_keeper` | Inventory/parts management |
| `hr_officer` | Human resources — training, compliance, contractor oversight |
| `trainee` | New employee in onboarding/training programme |
| `floor_operator` | Machine operator on the production floor |

> **Note on naming:** `AUTHENTICATION_README.md` refers to this role as `maintenance_supervisor`, but the codebase (`src/types/auth.ts`, router, nav config) uses `supervisor`. `supervisor` is the source of truth.

Authentication is Firebase Auth + a Firestore `users` collection; state is held in a Zustand `authStore`; multi-tenant isolation is via `siteId` on each user/document.

---

## 2. Role → Feature Access Matrix

✓ = full access to the module (subject to in-module action limits noted in §3) · v = view-only / limited · — = no access

| Feature Module | admin | plant_manager | supervisor | technician | store_keeper | hr_officer | trainee | floor_operator |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard (role-specific) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Machines / Asset Registry | ✓ | ✓ | ✓ | v | — | — | v | — |
| Breakdowns | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| Work Orders | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| My Work Orders | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | — |
| Sign-Off Queue | ✓ | ✓ | ✓ | — | — | — | — | — |
| PM Schedules / Calendar / Compliance | ✓ | ✓ | ✓ | v* | — | — | — | — |
| Inventory / Parts / Purchase Orders | ✓ | ✓ | ✓ | v | ✓ | — | v | — |
| Contractors | ✓ | ✓ | ✓ | — | — | v | — | — |
| Reports | ✓ | ✓ | ✓ | — | — | ✓ | — | — |
| Analytics | ✓ | ✓ | ✓ | — | — | — | — | — |
| Shift / My Shift | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Shift Handovers (create/review) | ✓ | v | ✓ | — | — | v | — | — |
| Training (manage) | ✓ | ✓ | v** | — | — | ✓ | — | — |
| My Training / My Certificates | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| My Program (trainee track) | ✓ | — | — | — | — | — | ✓ | — |
| Triage (guided troubleshooting) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Triage Builder | ✓ | ✓ | ✓ | — | — | ✓ | — | — |
| OEE (Overall Equipment Effectiveness) | ✓ | ✓ | ✓ | — | — | — | — | — |
| Kaizen (continuous improvement) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Audit (TPM/5S/OEE/Contractor) | ✓ | ✓ | ✓ | — | — | ✓ | — | — |
| Evaluations | ✓ | ✓ | ✓ | — | — | ✓ | — | — |
| User Management | ✓ | ✓ | ✓ | — | — | ✓ | — | — |
| Shift Config | ✓ | ✓ | — | — | — | — | — | — |
| Settings | ✓ | — | — | — | — | — | — | — |
| Billing & Plan | ✓ | — | — | — | — | — | — | — |

\* Technicians can view PM Schedules but cannot edit them.
\*\* Supervisors can view/participate but module authoring (create/edit modules, quizzes, compliance reports) is restricted to `plant_manager`, `admin`, `hr_officer`.

---

## 3. Feature Modules in Detail

### Dashboard
Role-specific landing dashboards, each showing relevant KPIs:
- `SupervisorDashboard`, `ManagerDashboard`, `TechnicianDashboard`, `TraineeDashboard`, `InventoryDashboard` (store keeper), `TrainingDashboard` (HR officer).
- Backed by rich aggregate types (KPI cards, breakdown kanban, machine health cells, technician performance, SLA summaries) computed client-side from operational collections when pre-aggregated `analytics_daily`/`analytics_monthly` collections are empty.

### Machines (Asset Registry) — Module 3
- **List**: search/filter, real-time updates, pagination.
- **Add Machine**: multi-step form (Basic Info → Location → Status/Criticality → Documents/Photos → Spare Parts/Notes), Zod validation, file upload to Storage, auto QR code generation.
- **Machine Profile**: tabs for Overview, Documents/Photos, Breakdown History, Maintenance History, Analytics (manager/admin only).
- **Edit Machine**, **QR Code page** (download PNG/PDF, print, regenerate — admin only).
- **Health Score** (0–100, color-coded): starts at 100, deducted for breakdowns by severity and overdue PM over a trailing 90-day window, credited for on-time PM.
- **Permissions**: view/edit/delete/generate-QR/decommission/view-analytics are gated per role (see machine-specific table below).

| Action | Technician | Store Keeper | Supervisor | Plant Manager | Admin | HR Officer | Floor Operator | Trainee |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View | ✓ | — | ✓ | ✓ | ✓ | — | — | ✓ |
| Edit | — | — | ✓ | ✓ | ✓ | — | — | — |
| Delete | — | — | — | — | ✓ | — | — | — |
| Generate QR | — | — | ✓ | ✓ | ✓ | — | — | — |
| Decommission | — | — | — | ✓ | ✓ | — | — | — |
| View Analytics | — | — | — | ✓ | ✓ | — | — | — |

*(Per the current router, `trainee` does have machine view access; `MODULE_3_MACHINES_README.md`'s table predates that and should be treated as stale.)*

### Breakdowns
Report, track, and resolve equipment breakdowns. Kanban-style status board, severity/type/root-cause tracking, notification log (push/SMS/email/in-app), QR-triggered check-in/report flows, optional WhatsApp integration. Open to `floor_operator`, `technician`, `supervisor`, `plant_manager`, `admin`, `trainee` (editing excludes trainee).

### Work Orders
Full work-order lifecycle: `DRAFT → OPEN → ASSIGNED → IN_PROGRESS → ON_HOLD (parts/approval) → COMPLETED → SIGNED_OFF → CLOSED/CANCELLED`. Supports multi-technician checklists with measurement inputs, time-segment tracking (travel/waiting/working), parts requests, and root-cause capture. A dedicated **Sign-Off Queue** lets supervisors/managers/admins approve closure. "My Work Orders" gives technicians/trainees a personal task view.

### Preventive Maintenance (PM)
Schedules (calendar-based or meter-based via operating hours/production cycles), PM calendar view, and a compliance dashboard (monthly trends, per-machine and per-technician compliance records, workload view). Editing restricted to supervisor/admin.

### Inventory & Parts
Parts catalog (categories: electrical/mechanical/hydraulic/pneumatic/automation/civil/custom), stock status tracking, multi-stage parts-request approval workflow (`pending_storekeeper → pending_supervisor → ...`), physical/manual stock issue, stock receiving, movement log, purchase orders, Excel import (+ import history), supplier management, and inventory-specific reports/settings. Store keeper owns day-to-day operations; supervisors/managers/admin oversee; technicians/trainees have limited view access for linking parts to work.

### Contractors
Contractor registry, technician sub-records, documents & compliance tracking, performance dashboard, history/analytics, and a **jobs** sub-area (job list/detail, log work, sign-off, invoice comparison, rate contractor). HR officer has broad view/compliance access; edits are supervisor/plant_manager/admin only.

### Reports & Analytics
- **Reports hub**: org-wide report generation/history, with optional push-to-Google-Sheets (falls back to CSV if OAuth isn't configured).
- **Analytics**: cross-module KPI dashboard (machine health, technician/contractor performance, SLA status, inventory health, training compliance, heatmaps). Restricted to supervisor/plant_manager/admin.

### Shift Management
- **My Shift**: available to everyone.
- **Shift Handover**: create/briefing (supervisor/admin), history/detail (adds plant_manager/hr_officer as viewers). Auto-compiles a shift summary snapshot (pending WOs, ongoing breakdowns, low-stock alerts, watch flags).
- **Shift Config**: admin and plant_manager (create/edit); deleting a shift stays admin-only.

### Training
- **Learner-facing** (My Modules, quizzes, My Certificates, My Program, Weekend Summary): available to everyone; "My Program" is trainee-focused (+admin).
- **Management** (dashboard, module libraries, create/edit modules, quiz builder, assign training, assignment tracking, trainee profiles/programmes, certificates manager, compliance report, content library): supervisor/plant_manager/admin/hr_officer, with module *authoring* and compliance reporting narrowed to plant_manager/admin/hr_officer.
- **Two separate module libraries.** They share no templates, no queries, no components, and no assign flow:
  - *Training tab* (`training/manage/modules*`) — machine/competency modules (`libraryScope: 'training'`). Internal vs Offboard/External category, machine filter, per-module Assign to users/roles/departments, and a live Assignment Progress table (module topic, assignee, assigner, assigned/completed dates, progress, marks, final decision).
  - *Trainee Management* (`training/manage/trainee-modules*`) — programme modules (`libraryScope: 'trainee_management'`). Training type / delivery mode / default training period are required; no per-module Assign — assignment stays trainee-first through the Assign Training wizard.
- Includes a structured 6–12 month **Trainee Programme** model with supervisor-reviewed weekend self-reports.

### Triage (Guided Troubleshooting)
- **Triage** (current/"knowledge" version): open to all 8 roles — multilingual (English/Sinhala/Tamil/Bengali) branching decision trees for safety guidance, categorized by phase (safety/assessment/safe action/document/wait) and danger level.
- **Triage Builder**: authoring tool for flows/templates — supervisor/plant_manager/admin/hr_officer (create/edit narrowed further, excluding plant_manager).
- A legacy triage flow-runner and history/session-detail views remain routed for continuity.

### OEE (Overall Equipment Effectiveness)
Equipment effectiveness tracking and metrics. Supervisor/plant_manager/admin only.

### Kaizen
Continuous-improvement idea board. Open to technician, store_keeper, supervisor, plant_manager, hr_officer, admin.

### Audit
Unified audit tool covering TPM, 5S, OEE, and Contractor audits in one flow. Supervisor/plant_manager/admin/hr_officer.

### Evaluations
Staff/contractor evaluation forms and a form builder. Plant_manager/admin/hr_officer (route also technically permits supervisor, though the nav menu does not surface it to supervisors — a minor inconsistency).

### Settings, User Management & Billing
- **Settings**: admin only.
- **User Management**: admin/supervisor/plant_manager/hr_officer.
- **Billing & Plan**: admin only; a `TrialExpiryBanner` surfaces when the company's subscription is on trial and expiring/expired, linking here.

---

## 4. Access Control Mechanism

- There is **no centralized RBAC/permissions config file**. Route access is enforced inline per-route via a `requiredRoles` array passed to `ProtectedRoute` (`src/components/auth/ProtectedRoute.tsx`) in `src/router/AppRouter.tsx`.
- `ProtectedRoute` waits for auth to initialize, redirects unauthenticated users to `/login` (preserving the intended path for QR deep-link continuity), and redirects authenticated users lacking the required role to `/app/unauthorized`.
- `PublicRoute` is the inverse guard: authenticated users hitting `/login`, `/register`, etc. are redirected to their role's default dashboard.
- The sidebar navigation (`NAV_ITEMS` in `src/components/layout/AppLayout.tsx`) is a role-filtered array that closely — but not perfectly — mirrors the route restrictions; a couple of pages are reachable by direct URL but not shown in the nav for certain roles (e.g., Evaluations for supervisors).
- Finer-grained action permissions (e.g., who can edit vs. only view a specific record) are generally enforced ad hoc within page components rather than through a shared permissions layer. The Machines module is the one place with an explicit typed permission model (`MachinePermission` / `MachineRolePermissions` in `src/types/machine.ts`).

---

## 5. Known Gaps / Inconsistencies (for future cleanup)

1. **Role naming drift**: `AUTHENTICATION_README.md` says `maintenance_supervisor`; the code uses `supervisor`.
2. **Orphaned modules**: `src/modules/tpm` (Total Productive Maintenance) and `src/modules/fives` (5S audit) are fully built (pages, services, hooks) but **not wired into the router or navigation** — likely superseded by the unified `Audit` module, or pending integration.
3. **Stale docs**: `MODULE_3_MACHINES_README.md`'s machine permissions table says `trainee` has no machine access; the live router grants `trainee` view access.
4. **Nav vs. route drift**: a few modules (e.g., Evaluations) are accessible by direct URL to a role that isn't shown the nav link for it.
5. **Duplicate type definition**: `UserRole` is independently declared in both `src/types/auth.ts` and `src/types/breakdown.ts`.
