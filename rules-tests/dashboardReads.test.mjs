// Every list query a role's dashboard makes must be readable by that role. Rules are not filters: one denied
// query leaves a widget silently empty (the listeners swallow the error), which is how roles that share the
// Manager dashboard (safety_officer) or have their own (hr_officer) ended up with "no data". Add a case here
// whenever a dashboard widget starts reading a new collection for a role.
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, describe, it } from 'node:test';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-firmicore',
    firestore: { rules: readFileSync(process.env.FIRESTORE_RULES_PATH ?? new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

const ROLES = ['admin', 'plant_manager', 'supervisor', 'hr_officer', 'safety_officer'];
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'companies/A'), { id: 'A', adminUserId: 'admin', status: 'active', plan: 'enterprise' });
    for (const r of ROLES) {
      await setDoc(doc(db, 'users', r), { uid: r, companyId: 'A', role: r, siteId: 'A', plantId: null });
      await setDoc(doc(db, `companies/A/users/${r}`), { id: r, companyId: 'A', role: r, siteIds: [], status: 'active', plantId: null });
    }
  });
});

const co = (name, ...c) => (db) => getDocs(query(collection(db, name), where('companyId', '==', 'A'), ...c));
const QUERIES = {
  shift_sessions: co('shift_sessions', where('status', '==', 'active')),
  shift_config: co('shift_config'),
  trainingAssignments: co('trainingAssignments'),
  trainingModules: co('trainingModules'),
  traineeProgrammes: co('traineeProgrammes', where('status', '==', 'active')),
  programAssignments: co('programAssignments'),
  safety_cases: co('safety_cases'),
  work_permits: co('work_permits'),
  workOrders: co('workOrders'),
  breakdown_tickets: co('breakdown_tickets'),
  machines: (db) => getDocs(query(collection(db, 'machines'), where('siteId', '==', 'A'))),
  pm_history: co('pm_history'),
  pm_schedules: co('pm_schedules'),
  contractorJobs: co('contractorJobs'),
  evaluations: co('evaluations'),
  roster: (db) => getDocs(collection(db, 'companies/A/users')),
};

// What each role's dashboard / analytics widgets read. Manager dashboard (admin, plant_manager, safety_officer):
// shift status, PM, safety cases, trainings, programme sign-off, KPIs. HR dashboard: KPI strip, shifts,
// evaluations, contractor scoreboard, programme sign-off.
const NEEDS = {
  admin: Object.keys(QUERIES),
  plant_manager: Object.keys(QUERIES),
  supervisor: ['shift_sessions', 'shift_config', 'trainingAssignments', 'traineeProgrammes', 'programAssignments', 'workOrders', 'breakdown_tickets', 'machines', 'pm_history', 'pm_schedules', 'roster'],
  hr_officer: ['shift_sessions', 'shift_config', 'trainingAssignments', 'trainingModules', 'traineeProgrammes', 'programAssignments',
    'workOrders', 'breakdown_tickets', 'machines', 'pm_history', 'contractorJobs', 'evaluations', 'roster'],
  safety_officer: ['shift_sessions', 'shift_config', 'trainingAssignments', 'trainingModules', 'traineeProgrammes', 'programAssignments',
    'safety_cases', 'work_permits', 'workOrders', 'breakdown_tickets', 'machines', 'pm_history', 'pm_schedules', 'roster'],
};

for (const [role, needs] of Object.entries(NEEDS)) {
  describe(`${role} dashboard reads`, () => {
    for (const name of needs) {
      it(`can list ${name}`, async () => {
        await assertSucceeds(QUERIES[name](env.authenticatedContext(role).firestore()));
      });
    }
  });
}
