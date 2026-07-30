# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

PulseMaint is a multi-tenant maintenance-management platform (CMMS): machine registry, breakdowns, work orders, PM scheduling, inventory/parts, contractors, shift handovers, training, triage/troubleshooting, OEE, Kaizen, audits, and analytics. Built with React + TypeScript + Vite, backed by Firebase (Auth, Firestore, Storage, Cloud Functions).

**The repo also contains a legacy/unused Vue scaffold** (`src/App.vue`, `src/main.js`, and the generic Vue boilerplate in `README.md`) — this is dead weight, not the active app. The real entry point is `src/main.tsx` → `src/App.tsx` → `src/router/AppRouter.tsx`. Don't edit the Vue files; they aren't wired to anything.

## Git workflow

Do not commit directly to `main`. For every fix or change, create a feature branch (e.g. `fix/<short-description>` or `claude/<short-description>`), commit there, and open a PR into `main` instead of pushing straight to it.

## Commands

Frontend (run from repo root):
```bash
npm run dev       # Vite dev server (port 5173)
npm run build     # production build
npm run preview   # preview production build
npm test          # vitest run (all tests, single run — no watch flag configured)
```

Run a single test file: `npx vitest run src/lib/__tests__/backlogUtils.test.ts`
Tests live in `src/lib/__tests__/`; there's no separate lint script in the root `package.json`.

Cloud Functions (run from `functions/`):
```bash
npm run serve     # firebase emulators:start --only functions
npm run shell     # firebase functions:shell
npm run lint      # eslint . (also runs as a predeploy hook via firebase.json)
npm run deploy    # firebase deploy --only functions
npm run logs      # firebase functions:log
```

Local Firebase emulators (auth/firestore/storage) are configured in `firebase.json`; the client wires up to them automatically when `VITE_USE_EMULATORS=1` is set (see `src/lib/firebase.ts`). Copy `.env.example` to `.env` before running the app — see that file for what each `VITE_*` var does (Firebase config, optional Google OAuth for Sheets export, optional Gemini key for AI root-cause suggestions).

## Architecture

### Multi-tenancy and auth
- Firebase Auth + a Firestore `users/{uid}` collection holds the app-level user profile (role, `siteId`, etc.); auth state lives in a Zustand `authStore` (`src/store/authStore.ts`).
- **Every tenant-scoped document carries a `siteId`**, and queries/security rules filter on it. When adding a new collection or query, always scope by the current user's `siteId`.
- `src/lib/firebase.ts` is the single Firebase init point (app, auth, db, storage, functions) — import from there rather than re-initializing.

### Role-based access control
- **9 roles**: `admin`, `plant_manager`, `supervisor`, `technician`, `store_keeper`, `hr_officer`, `trainee`, `floor_operator`, `safety_officer` (defined in `src/types/auth.ts`; note `UserRole` is also separately declared in `src/types/breakdown.ts` — a known duplication, so the role string must be added to **both** unions). `safety_officer` is an EHS role with a dedicated workspace under `src/modules/safety` (routes `/app/safety/*`): a Safety Dashboard (total/open cases, near-miss 30d, safety trainings today, active permits, days-since-incident), Work Permits (Permit-to-Work with categories + precautions on the `work_permits` collection), a Safety Calendar (scheduled training + active permit windows), and Safety Analytics. Safety cases (incident/near-miss/hazard/unsafe-act) live in the `safety_cases` collection — any company member can report one; `canManageSafety()` (safety_officer + supervisors + managers) triages/closes them and issues permits. The role's sidebar is deliberately trimmed to a safety-focused set (Dashboard, Breakdowns, Work Permits, Safety Training→training manage, Safety Calendar, Analytics→safety, My Shift, Reports, My Training, Triage, Triage Builder, Audit) and it lands on `/app/safety/dashboard`. Beyond those it still has company-wide read access to the operational modules by route/rules, with no repair/write actions.
- **There is no centralized RBAC config.** Access is enforced inline, per-route, via a `requiredRoles` array passed to `ProtectedRoute` (`src/components/auth/ProtectedRoute.tsx`) in `src/router/AppRouter.tsx`. `PublicRoute` is the inverse guard for auth pages.
- The sidebar nav (`NAV_ITEMS` in `src/components/layout/AppLayout.tsx`) is a separately-maintained, role-filtered list that *mostly* mirrors route restrictions but can drift (a page reachable by direct URL isn't always in the nav for that role, and vice versa) — when changing access for a role, update both.
- Finer-grained in-page permissions (view vs. edit vs. delete a specific record) are generally ad hoc per component, not centralized. The Machines module is the one exception with an explicit typed permission model: `MachinePermission` / `MachineRolePermissions` in `src/types/machine.ts`.
- Full role × feature access matrix is documented in `FEATURES.md` — check it before changing which roles can reach a module.

### Frontend structure
- `src/pages/` — route-level page components, one subfolder per module (machines, workorders, breakdowns, pm, inventory, contractors, shift, training, triage, triage-builder, analytics, reports, billing, settings, auth).
- `src/modules/` — self-contained feature modules with their own pages/services/hooks (audit, evaluation, kaizen, oee, tpm, fives). **`tpm` and `fives` are built but not wired into the router/nav** — likely superseded by the unified `audit` module; don't assume they're reachable in the live app.
- `src/features/triage/` — newer triage ("knowledge") implementation, distinct from the legacy flow-runner still routed under `src/pages/triage/`.
- **Training has two fully separate module libraries**, told apart by the required `libraryScope` field on `trainingModules` (`'training'` | `'trainee_management'`). Each owns its own hook (`useTrainingLibraryModules` / `useTraineeLibraryModules`, both filtering server-side), component (`components/training/manager/library/TrainingModuleLibrary` / `TraineeModuleLibrary`), settings form, editor routes (`training/manage/modules*` / `training/manage/trainee-modules*`), sample seeder, and validator. They must not import each other or share a query — if something needs an `if` on which library it is, duplicate it instead. Modules predating `libraryScope` are invisible to both until `seed/backfillLibraryScope.mjs` runs.
- `src/store/` — Zustand stores (auth, dashboard, handover, pm, reports).
- `src/services/` — cross-cutting business logic / Firestore access (analytics, handover, reports, team performance, trainee program).
- `src/lib/` — utilities: machine health scoring, QR generation, date formatting, RCA, reliability calcs, i18n setup, LOTO gating, etc. Domain-heavy pure functions here are the ones under test in `src/lib/__tests__/`.
- `src/types/` — domain types per feature area; `src/schemas/` — matching Zod validation schemas.
- Path alias `@/*` → `src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

### Client-side analytics computation
Dashboards and reports compute their metrics client-side from operational collections (breakdowns, work orders, contractor jobs, PM history, machines) whenever the pre-aggregated `analytics_monthly` / `analytics_daily` / `machine_health` collections are empty. No backend aggregation job is required for the app to function — those collections are an optimization path, not a hard dependency.

### Machine health scoring
`src/lib/machineHealth.ts` computes a 0–100 health score per machine: starts at 100, deducted for breakdowns by severity and overdue PM within a trailing 90-day window, credited for on-time PM. See `MODULE_3_MACHINES_README.md` for the exact algorithm — but note its permissions table is stale (says `trainee` has no machine access; the live router grants view access).

### Cloud Functions (`functions/`)
Organized by feature area under `functions/src/` (analytics, contractors, handover, inventory, invitations, lib, pm, reports, training, triage), entry point `functions/index.js`. Uses `firebase-admin` / `firebase-functions` v7, plus `puppeteer-core` + `@sparticuz/chromium` for server-side PDF/rendering work and `googleapis`/`nodemailer` for Sheets/email integrations. Node 22 runtime. Lint runs automatically as a `predeploy` hook (`firebase.json`).

### Firestore/Storage
- `firestore.rules` and `storage.rules` are the source of truth for server-side access control — always check these when changing what a role/query can read or write, since client-side route guards are not a security boundary on their own.
- `firestore.indexes.json` holds required composite indexes; new queries that filter/sort on multiple fields (almost always including `siteId`) typically need a matching entry here.

## Known gaps (don't silently "fix" without asking — may be intentional or a larger cleanup)
1. Role naming drift: `AUTHENTICATION_README.md` calls one role `maintenance_supervisor`; the actual code uses `supervisor`.
2. `src/modules/tpm` and `src/modules/fives` are fully built but orphaned (not routed/navigable).
3. Nav vs. route access can drift for a given role/page (e.g. Evaluations is reachable by supervisors via URL but not shown in their nav).
4. `UserRole` type is declared independently in both `src/types/auth.ts` and `src/types/breakdown.ts`.
