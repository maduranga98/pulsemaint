// Firestore security-rules tests. Run with `npm test` in this folder (starts the
// Firestore + Storage emulators). Covers the two classes of problem these rules
// guard against: privilege escalation through the users mapping / profile docs,
// and role-only rules that let one company reach another company's data.
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, describe, it } from 'node:test';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, documentId,
  serverTimestamp, arrayUnion,
} from 'firebase/firestore';

const PROJECT = 'demo-firmicore';
let env;

const future = () => new Date(Date.now() + 86_400_000);
const past = () => new Date(Date.now() - 86_400_000);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(process.env.FIRESTORE_RULES_PATH ?? new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });

const as = (uid, claims = {}) => env.authenticatedContext(uid, claims).firestore();
const anon = () => env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();

/** Mapping + profile for a company member. */
async function seedUser(db, uid, companyId, role, extra = {}) {
  await setDoc(doc(db, 'users', uid), { uid, companyId, role, siteId: companyId, plantId: extra.plantId ?? null });
  await setDoc(doc(db, `companies/${companyId}/users/${uid}`), {
    id: uid, companyId, role, siteIds: [], status: 'active', plantId: extra.plantId ?? null,
    email: `${uid}@${companyId}.test`, ...extra.profile,
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const c of ['A', 'B']) {
      await setDoc(doc(db, 'companies', c), { id: c, adminUserId: `admin${c}`, status: 'active', plan: 'enterprise' });
      await seedUser(db, `admin${c}`, c, 'admin');
      await seedUser(db, `sup${c}`, c, 'supervisor');
      await seedUser(db, `tech${c}`, c, 'technician');
      await seedUser(db, `floor${c}`, c, 'floor_operator');
      await setDoc(doc(db, 'workOrders', `wo${c}`), {
        siteId: c, companyId: c, status: 'OPEN', assignedTechnicianIds: [`tech${c}`], supervisorInChargeId: `sup${c}`,
      });
      await setDoc(doc(db, 'machines', `m${c}`), { siteId: c, companyId: c, name: `Machine ${c}` });
      await setDoc(doc(db, 'breakdown_tickets', `bd${c}`), { siteId: c, companyId: c, machineId: `m${c}`, status: 'reported' });
      await setDoc(doc(db, 'permits', `p${c}`), { siteId: c, workOrderId: `wo${c}`, status: 'draft' });
      await setDoc(doc(db, 'conditionReadings', `r${c}`), { siteId: c, machineId: `m${c}`, value: 1 });
      await setDoc(doc(db, `machineHistory/m${c}/entries/e1`), { woId: `wo${c}`, date: new Date() });
      await setDoc(doc(db, 'safety_cases', `sc${c}`), { companyId: c, status: 'open' });
      await setDoc(doc(db, 'moeSnapshots', `snap${c}`), { siteId: c });
      await setDoc(doc(db, 'moeConfig', c), { x: 1 });
      await setDoc(doc(db, 'siteConfig', c), { x: 1 });
      await setDoc(doc(db, `workOrders/wo${c}/partsRequests/pr1`), { status: 'requested' });
    }
    await setDoc(doc(db, 'triageTemplates', 't1'), { name: 'shared' });
    await setDoc(doc(db, 'companies/A/invitations/inv1'), {
      id: 'inv1', companyId: 'A', email: 'invitee@example.com', role: 'technician', plantId: null,
      status: 'pending', expiresAt: future(),
    });
    await setDoc(doc(db, 'companies/A/invitations/invAdmin'), {
      id: 'invAdmin', companyId: 'A', email: 'invitee@example.com', role: 'technician', plantId: null,
      status: 'revoked', expiresAt: future(),
    });
    await setDoc(doc(db, 'companies/A/invitations/invOld'), {
      id: 'invOld', companyId: 'A', email: 'invitee@example.com', role: 'technician', plantId: null,
      status: 'pending', expiresAt: past(),
    });
  });
});

describe('users mapping + profile cannot be self-escalated', () => {
  it('a technician cannot make themselves admin', async () => {
    const db = as('techA');
    await assertFails(updateDoc(doc(db, 'users/techA'), { role: 'admin' }));
    await assertFails(setDoc(doc(db, 'users/techA'), { uid: 'techA', companyId: 'A', role: 'admin', siteId: 'A' }, { merge: true }));
  });
  it('a technician cannot move their mapping to another company', async () => {
    const db = as('techA');
    await assertFails(updateDoc(doc(db, 'users/techA'), { companyId: 'B' }));
  });
  it('a technician cannot edit role/company/plant/department on their own profile', async () => {
    const db = as('techA');
    await assertFails(updateDoc(doc(db, 'companies/A/users/techA'), { role: 'admin' }));
    await assertFails(updateDoc(doc(db, 'companies/A/users/techA'), { plantId: 'other' }));
    await assertFails(updateDoc(doc(db, 'companies/A/users/techA'), { department: 'Maintenance' }));
    await assertSucceeds(updateDoc(doc(db, 'companies/A/users/techA'), { lastLoginAt: new Date() }));
  });
  it('a deactivated user cannot re-activate themselves', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'companies/A/users/techA'), { status: 'inactive' }));
    await assertFails(updateDoc(doc(as('techA'), 'companies/A/users/techA'), { status: 'active' }));
  });
  it('a stranger cannot create a mapping or profile in any company', async () => {
    const db = as('attacker', { email: 'attacker@example.com' });
    await assertFails(setDoc(doc(db, 'users/attacker'), { uid: 'attacker', companyId: 'A', role: 'admin', siteId: 'A' }));
    await assertFails(setDoc(doc(db, 'companies/A/users/attacker'), { id: 'attacker', companyId: 'A', role: 'admin', siteIds: [] }));
    await assertFails(setDoc(doc(db, 'companies/A/users/attacker'), { id: 'attacker', companyId: 'A', role: 'technician', siteIds: [], invitationId: 'nope' }));
  });
  it('the existing login sync (merge of values equal to the profile) still works', async () => {
    const db = as('techA');
    await assertSucceeds(setDoc(doc(db, 'users/techA'), { uid: 'techA', companyId: 'A', role: 'technician', siteId: 'A', plantId: null }, { merge: true }));
  });
  it('an admin cannot touch another company\'s users, but can manage their own', async () => {
    await assertFails(updateDoc(doc(as('adminB'), 'users/techA'), { role: 'supervisor' }));
    await assertFails(updateDoc(doc(as('adminB'), 'companies/A/users/techA'), { role: 'supervisor' }));
    await assertFails(deleteDoc(doc(as('adminB'), 'users/techA')));
    await assertSucceeds(updateDoc(doc(as('adminA'), 'users/techA'), { role: 'supervisor', plantId: null }));
    await assertSucceeds(updateDoc(doc(as('adminA'), 'companies/A/users/techA'), { role: 'supervisor' }));
  });
  it('only admin / HR change someone\'s role mapping; HR never grants admin or edits their own', async () => {
    await env.withSecurityRulesDisabled((c) => seedUser(c.firestore(), 'hrA', 'A', 'hr_officer'));
    await assertFails(setDoc(doc(as('supA'), 'users/techA'), { role: 'plant_manager', plantId: null }, { merge: true }));
    await assertFails(setDoc(doc(as('supA'), 'users/supA'), { role: 'plant_manager' }, { merge: true }));
    await assertSucceeds(setDoc(doc(as('hrA'), 'users/techA'), { role: 'supervisor', plantId: null }, { merge: true }));
    await assertFails(setDoc(doc(as('hrA'), 'users/techA'), { role: 'admin' }, { merge: true }));
    await assertFails(setDoc(doc(as('hrA'), 'users/adminA'), { role: 'technician' }, { merge: true }));
    await assertFails(setDoc(doc(as('hrA'), 'users/hrA'), { role: 'plant_manager' }, { merge: true }));
  });
  it('supervisors / plant managers edit colleagues\' non-access profile fields only', async () => {
    await assertSucceeds(updateDoc(doc(as('supA'), 'companies/A/users/techA'), { jobTitle: 'Senior technician' }));
    await assertFails(updateDoc(doc(as('supA'), 'companies/A/users/techA'), { role: 'plant_manager' }));
    await assertFails(updateDoc(doc(as('supA'), 'companies/A/users/techA'), { status: 'inactive' }));
    await assertFails(updateDoc(doc(as('supA'), 'companies/A/users/supA'), { role: 'plant_manager' }));
    await assertFails(setDoc(doc(as('supA'), 'companies/A/users/newbie'), { id: 'newbie', companyId: 'A', role: 'technician', siteIds: [] }));
  });
  it('a mapping\'s department can only mirror the profile', async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'companies/A/users/techA'), { department: 'Mechanical' }));
    await assertFails(setDoc(doc(as('techA'), 'users/techA'), { department: 'Electrical' }, { merge: true }));
    await assertSucceeds(setDoc(doc(as('techA'), 'users/techA'), { department: 'Mechanical' }, { merge: true }));
  });
  it('managers can only read same-company mapping docs (list needs a companyId filter)', async () => {
    const db = as('adminA');
    await assertSucceeds(getDocs(query(collection(db, 'users'), where('companyId', '==', 'A'), where(documentId(), 'in', ['techA', 'supA']))));
    await assertFails(getDocs(query(collection(db, 'users'), where(documentId(), 'in', ['techA', 'techB']))));
    await assertFails(getDoc(doc(db, 'users/techB')));
    await assertSucceeds(getDoc(doc(as('techA'), 'users/techA')));
  });
});

describe('company registration and invitations', () => {
  const email = (e) => ({ email: e });
  it('a new company admin can register: company, profile, mapping', async () => {
    const db = as('newAdmin', email('new@admin.test'));
    await assertSucceeds(setDoc(doc(db, 'companies/C'), {
      id: 'C', adminUserId: 'newAdmin', approvalStatus: 'pending', status: 'trial', plan: 'starter',
    }));
    await assertSucceeds(setDoc(doc(db, 'companies/C/users/newAdmin'), { id: 'newAdmin', companyId: 'C', role: 'admin', siteIds: [], status: 'active' }));
    await assertSucceeds(setDoc(doc(db, 'users/newAdmin'), { uid: 'newAdmin', companyId: 'C', role: 'admin', siteId: 'C' }));
  });
  it('someone cannot register as admin of a company they do not own', async () => {
    const db = as('mallory', email('m@x.test'));
    await assertFails(setDoc(doc(db, 'companies/A/users/mallory'), { id: 'mallory', companyId: 'A', role: 'admin', siteIds: [] }));
  });
  it('a valid invitation lets the invitee create profile + mapping and accept it', async () => {
    const db = as('invitee', email('Invitee@Example.com'));
    await assertSucceeds(setDoc(doc(db, 'companies/A/users/invitee'), {
      id: 'invitee', companyId: 'A', role: 'technician', siteIds: [], status: 'active', plantId: null, invitationId: 'inv1',
    }));
    await assertSucceeds(setDoc(doc(db, 'users/invitee'), { uid: 'invitee', companyId: 'A', role: 'technician', siteId: 'A', plantId: null }));
    await assertSucceeds(updateDoc(doc(db, 'companies/A/invitations/inv1'), { status: 'accepted', acceptedAt: new Date(), acceptedUserId: 'invitee' }));
  });
  it('invitation misuse is rejected', async () => {
    const wrongEmail = as('x1', email('someone@else.test'));
    await assertFails(setDoc(doc(wrongEmail, 'companies/A/users/x1'), { id: 'x1', companyId: 'A', role: 'technician', siteIds: [], invitationId: 'inv1', plantId: null }));
    const ok = as('invitee', email('invitee@example.com'));
    await assertFails(setDoc(doc(ok, 'companies/A/users/invitee'), { id: 'invitee', companyId: 'A', role: 'admin', siteIds: [], invitationId: 'inv1', plantId: null }));
    await assertFails(setDoc(doc(ok, 'companies/A/users/invitee'), { id: 'invitee', companyId: 'A', role: 'technician', siteIds: [], invitationId: 'invAdmin', plantId: null }));
    await assertFails(setDoc(doc(ok, 'companies/A/users/invitee'), { id: 'invitee', companyId: 'A', role: 'technician', siteIds: [], invitationId: 'invOld', plantId: null }));
    await assertFails(updateDoc(doc(wrongEmail, 'companies/A/invitations/inv1'), { status: 'accepted', acceptedUserId: 'x1', acceptedAt: new Date() }));
  });
});

// The payload PublicBreakdownReportPage writes for machine mA (company A).
const qrTicket = (over = {}) => ({
  ticketNumber: 'BD-2026-ABC123', siteId: 'A', companyId: 'A', machineId: 'mA', machineName: 'Machine A',
  machineDepartment: '', machinePlantId: null, machineLocation: '', machineCriticality: 3,
  severity: null, type: null, description: 'Motor is overheating badly', productionImpact: '',
  currentProductionCount: null, attemptedFixes: '', machineStillRunning: false, photos: [], video: null,
  source: 'qr_scan', reportedBy: null, reporterName: null, reporterRole: null, reportedAt: serverTimestamp(),
  status: 'reported', statusHistory: [], assignedTechnicianIds: [], assignedTechnicianNames: [],
  assignedContractorId: null, assignedBy: null, assignedByName: null, attendedBy: null, attendedByName: null,
  attendedAt: null, acknowledgedAt: null, acknowledgedBy: null, assignedAt: null, enRouteAt: null,
  repairStartedAt: null, resolvedAt: null, closedAt: null, slaDeadline: null, ...over,
});

describe('cross-company isolation', () => {
  it('work orders: admins/supervisors only reach their own company', async () => {
    await assertSucceeds(getDoc(doc(as('adminA'), 'workOrders/woA')));
    await assertFails(getDoc(doc(as('adminB'), 'workOrders/woA')));
    await assertFails(updateDoc(doc(as('adminB'), 'workOrders/woA'), { status: 'CLOSED' }));
    await assertFails(deleteDoc(doc(as('adminB'), 'workOrders/woA')));
    await assertFails(addDoc(collection(as('adminB'), 'workOrders'), { siteId: 'A', companyId: 'A', status: 'OPEN' }));
    await assertSucceeds(addDoc(collection(as('adminA'), 'workOrders'), { siteId: 'A', companyId: 'A', status: 'OPEN' }));
    await assertSucceeds(getDoc(doc(as('supA'), 'workOrders/woA')));
    await assertFails(getDoc(doc(as('supB'), 'workOrders/woA')));
    await assertSucceeds(getDocs(query(collection(as('supA'), 'workOrders'), where('siteId', '==', 'A'))));
    await assertFails(getDocs(query(collection(as('supB'), 'workOrders'), where('siteId', '==', 'A'))));
  });
  it('a supervisor with no siteId on their mapping is still limited to their company', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users/supA'), { uid: 'supA', companyId: 'A', role: 'supervisor', siteId: null }));
    await assertSucceeds(getDoc(doc(as('supA'), 'workOrders/woA')));
    await assertFails(getDoc(doc(as('supA'), 'workOrders/woB')));
    await assertFails(updateDoc(doc(as('supA'), 'workOrders/woB'), { status: 'CLOSED' }));
  });
  it('an assigned technician can still read and update their own work order', async () => {
    await assertSucceeds(getDocs(query(collection(as('techA'), 'workOrders'), where('assignedTechnicianIds', 'array-contains', 'techA'))));
    await assertSucceeds(updateDoc(doc(as('techA'), 'workOrders/woA'), { status: 'IN_PROGRESS', updatedAt: new Date() }));
  });
  it('parts requests follow their work order\'s company', async () => {
    await assertSucceeds(getDoc(doc(as('adminA'), 'workOrders/woA/partsRequests/pr1')));
    await assertFails(getDoc(doc(as('adminB'), 'workOrders/woA/partsRequests/pr1')));
    await assertFails(deleteDoc(doc(as('adminB'), 'workOrders/woA/partsRequests/pr1')));
  });
  it('machines: scoped reads/writes; anonymous QR visitors get no direct machine access', async () => {
    await assertSucceeds(getDocs(query(collection(as('techA'), 'machines'), where('siteId', '==', 'A'))));
    await assertFails(getDocs(query(collection(as('techB'), 'machines'), where('siteId', '==', 'A'))));
    await assertFails(getDoc(doc(as('techB'), 'machines/mA')));
    await assertFails(updateDoc(doc(as('adminB'), 'machines/mA'), { name: 'x' }));
    await assertFails(deleteDoc(doc(as('supB'), 'machines/mA')));
    await assertSucceeds(updateDoc(doc(as('supA'), 'machines/mA'), { name: 'ok', siteId: 'A', companyId: 'A' }));
    await assertFails(getDoc(doc(anon(), 'machines/mA')));
    await assertFails(getDocs(query(collection(anon(), 'machines'), where('siteId', '==', 'A'))));
  });
  it('breakdown tickets: scoped by site/company or by machine; QR visitors can still report', async () => {
    await assertSucceeds(getDocs(query(collection(as('techA'), 'breakdown_tickets'), where('siteId', '==', 'A'))));
    await assertSucceeds(getDocs(query(collection(as('techA'), 'breakdown_tickets'), where('companyId', '==', 'A'))));
    await assertSucceeds(getDocs(query(collection(as('techA'), 'breakdown_tickets'), where('machineId', '==', 'mA'))));
    await assertFails(getDocs(query(collection(as('techB'), 'breakdown_tickets'), where('siteId', '==', 'A'))));
    await assertFails(getDocs(query(collection(as('techB'), 'breakdown_tickets'), where('machineId', '==', 'mA'))));
    await assertFails(getDoc(doc(as('adminB'), 'breakdown_tickets/bdA')));
    await assertFails(updateDoc(doc(as('adminB'), 'breakdown_tickets/bdA'), { status: 'closed' }));
    await assertFails(deleteDoc(doc(as('adminB'), 'breakdown_tickets/bdA')));
    await assertSucceeds(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket()));
    await assertSucceeds(addDoc(collection(as('floorA'), 'breakdown_tickets'), { siteId: 'A', companyId: 'A', machineId: 'mA', status: 'reported' }));
    await assertFails(addDoc(collection(as('floorB'), 'breakdown_tickets'), { siteId: 'A', companyId: 'A', machineId: 'mA', status: 'reported' }));
  });
  it('LOTO permits, condition readings and machine history follow their parent', async () => {
    await assertSucceeds(getDocs(query(collection(as('techA'), 'permits'), where('workOrderId', '==', 'woA'))));
    await assertFails(getDocs(query(collection(as('techB'), 'permits'), where('workOrderId', '==', 'woA'))));
    await assertFails(deleteDoc(doc(as('adminB'), 'permits/pA')));
    await assertFails(addDoc(collection(as('techB'), 'permits'), { siteId: 'A', workOrderId: 'woA' }));
    await assertSucceeds(getDocs(query(collection(as('techA'), 'conditionReadings'), where('machineId', '==', 'mA'))));
    await assertFails(getDocs(query(collection(as('techB'), 'conditionReadings'), where('machineId', '==', 'mA'))));
    await assertSucceeds(getDocs(collection(as('techA'), 'machineHistory/mA/entries')));
    await assertFails(getDocs(collection(as('techB'), 'machineHistory/mA/entries')));
    await assertFails(addDoc(collection(as('techB'), 'machineHistory/mA/entries'), { woId: 'x', date: new Date() }));
  });
  it('admin-only deletes and settings are company-scoped', async () => {
    await assertFails(deleteDoc(doc(as('adminB'), 'safety_cases/scA')));
    await assertSucceeds(deleteDoc(doc(as('adminA'), 'safety_cases/scA')));
    await assertFails(setDoc(doc(as('adminB'), 'siteConfig/A'), { x: 2 }));
    await assertSucceeds(setDoc(doc(as('adminA'), 'siteConfig/A'), { x: 2 }));
    await assertFails(getDoc(doc(as('adminB'), 'moeSnapshots/snapA')));
    await assertSucceeds(getDoc(doc(as('adminA'), 'moeSnapshots/snapA')));
    await assertFails(setDoc(doc(as('adminB'), 'moeConfig/A'), { x: 2 }));
    await assertFails(getDoc(doc(as('adminB'), 'moeConfig/A')));
    await assertSucceeds(setDoc(doc(as('adminA'), 'moeConfig/A'), { x: 2 }));
  });
  it('shared triage templates are read-only for customers', async () => {
    await assertSucceeds(getDoc(doc(as('adminA'), 'triageTemplates/t1')));
    await assertFails(setDoc(doc(as('adminA'), 'triageTemplates/t1'), { name: 'hacked' }));
    await assertSucceeds(setDoc(doc(as('root', { superadmin: true }), 'triageTemplates/t1'), { name: 'ok' }));
  });
});

describe('anonymous QR breakdown reports are tied to the real machine', () => {
  it('the form\'s own payload works; other companies, unknown machines and extra fields do not', async () => {
    await assertSucceeds(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket()));
    // Filed against company A's machine but into company B's queue.
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ siteId: 'B', companyId: 'B' })));
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ machineId: 'nope' })));
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ machinePlantId: 'other-plant' })));
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ status: 'closed' })));
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ reportedBy: 'adminA' })));
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ reportedAt: new Date(2020, 0, 1) })));
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ description: 'short' })));
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ estimatedDowntimeMinutes: 9999 })));
    await assertFails(addDoc(collection(anon(), 'breakdown_tickets'), qrTicket({ assignedTechnicianIds: ['techA'] })));
  });
});

describe('deactivated users lose access at once', () => {
  const deactivate = (uid, c) => env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await updateDoc(doc(db, `companies/${c}/users/${uid}`), { status: 'inactive' });
    await updateDoc(doc(db, `users/${uid}`), { status: 'inactive' });
  });
  it('an inactive admin can no longer read or change company data', async () => {
    await assertSucceeds(getDoc(doc(as('adminA'), 'workOrders/woA')));
    await deactivate('adminA', 'A');
    await assertFails(getDoc(doc(as('adminA'), 'workOrders/woA')));
    await assertFails(updateDoc(doc(as('adminA'), 'workOrders/woA'), { status: 'CLOSED' }));
    await assertFails(getDocs(query(collection(as('adminA'), 'machines'), where('siteId', '==', 'A'))));
    await assertFails(updateDoc(doc(as('adminA'), 'users/techA'), { role: 'supervisor' }));
    await assertFails(updateDoc(doc(as('adminA'), 'companies/A/users/techA'), { role: 'supervisor' }));
  });
  it('an inactive technician cannot touch their work, their profile or re-activate their mapping', async () => {
    await deactivate('techA', 'A');
    await assertFails(getDocs(query(collection(as('techA'), 'workOrders'), where('assignedTechnicianIds', 'array-contains', 'techA'))));
    await assertFails(updateDoc(doc(as('techA'), 'workOrders/woA'), { status: 'IN_PROGRESS' }));
    await assertFails(updateDoc(doc(as('techA'), 'companies/A/users/techA'), { lastLoginAt: new Date() }));
    await assertFails(setDoc(doc(as('techA'), 'users/techA'), { status: 'active' }, { merge: true }));
    // They can still see their own (deactivated) profile, so the app can sign them out.
    await assertSucceeds(getDoc(doc(as('techA'), 'companies/A/users/techA')));
  });
  it('other members are unaffected', async () => {
    await deactivate('techA', 'A');
    await assertSucceeds(getDoc(doc(as('adminA'), 'workOrders/woA')));
  });
});

describe('trainees cannot pass or certify themselves', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await seedUser(db, 'trainA', 'A', 'trainee');
      await setDoc(doc(db, 'trainingAssignments/ta1'), {
        companyId: 'A', traineeId: 'trainA', moduleId: 'mod1', status: 'not_started', category: 'machine',
        lessonProgress: {}, lessonsCompleted: 0, overallProgress: 0, quizPassed: false, attemptsUsed: 0,
      });
      await setDoc(doc(db, 'trainingAssignments/taOff'), {
        companyId: 'A', traineeId: 'trainA', moduleId: 'mod2', status: 'in_progress', category: 'offboard',
      });
      await setDoc(doc(db, 'trainingAssignments/taSup'), {
        companyId: 'A', traineeId: 'supA', moduleId: 'mod1', status: 'awaiting_practical', category: 'machine',
      });
    });
  });
  it('lesson progress and starting the module still work', async () => {
    const db = as('trainA');
    await assertSucceeds(updateDoc(doc(db, 'trainingAssignments/ta1'), {
      'lessonProgress.l1.completed': true, lessonsCompleted: 1, overallProgress: 50,
      status: 'in_progress', startedAt: new Date(), lastActivityAt: new Date(),
    }));
  });
  it('quiz results, pass flags and certification are not trainee-writable', async () => {
    const db = as('trainA');
    await assertFails(updateDoc(doc(db, 'trainingAssignments/ta1'), { status: 'certified' }));
    await assertFails(updateDoc(doc(db, 'trainingAssignments/ta1'), { status: 'quiz_passed', quizPassed: true }));
    await assertFails(updateDoc(doc(db, 'trainingAssignments/ta1'), { status: 'awaiting_practical' }));
    await assertFails(updateDoc(doc(db, 'trainingAssignments/ta1'), { bestScore: 100, latestScore: 100 }));
    await assertFails(updateDoc(doc(db, 'trainingAssignments/ta1'), { attemptsUsed: 0, quizAttempts: [] }));
    await assertFails(updateDoc(doc(db, 'trainingAssignments/ta1'), { practicalSignOff: { passed: true } }));
    await assertFails(updateDoc(doc(db, 'trainingAssignments/ta1'), { companyId: 'B' }));
    await assertFails(setDoc(doc(db, 'trainingCertificates/forged'), { companyId: 'A', traineeId: 'trainA', score: 100 }));
  });
  it('an offboard trainee can still submit their completion report', async () => {
    await assertSucceeds(updateDoc(doc(as('trainA'), 'trainingAssignments/taOff'), {
      offboardCompletion: { knowledgeGained: 'x', reportSubmittedAt: new Date() },
      status: 'awaiting_practical', lastActivityAt: new Date(), completedAt: new Date(),
    }));
    await assertFails(updateDoc(doc(as('trainA'), 'trainingAssignments/ta1'), {
      offboardCompletion: { knowledgeGained: 'x' }, status: 'awaiting_practical',
    }));
  });
  it('managers sign off other people\'s training, never their own', async () => {
    await assertSucceeds(updateDoc(doc(as('supA'), 'trainingAssignments/ta1'), { status: 'certified' }));
    await assertFails(updateDoc(doc(as('supA'), 'trainingAssignments/taSup'), { status: 'certified' }));
    await assertFails(updateDoc(doc(as('supB'), 'trainingAssignments/ta1'), { status: 'certified' }));
  });
  it('the sign-off screen can check whether a certificate exists yet', async () => {
    await assertSucceeds(getDoc(doc(as('supA'), 'trainingCertificates/cert_ta1')));
    await assertFails(getDoc(doc(as('trainA'), 'trainingCertificates/cert_ta1')));
  });
});

describe('cross-company writes by document id', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'triageFlows/fB'), { companyId: 'B', name: 'B flow' });
      await setDoc(doc(db, 'triageSessions/sB'), { companyId: 'B', status: 'open' });
    });
  });
  it('triage flows and sessions of another company cannot be overwritten or deleted', async () => {
    await assertFails(setDoc(doc(as('adminA'), 'triageFlows/fB'), { companyId: 'A', name: 'taken' }));
    await assertFails(deleteDoc(doc(as('adminA'), 'triageFlows/fB')));
    await assertFails(setDoc(doc(as('supA'), 'triageSessions/sB'), { companyId: 'A' }));
    await assertFails(deleteDoc(doc(as('supA'), 'triageSessions/sB')));
    await assertSucceeds(setDoc(doc(as('adminB'), 'triageFlows/fB'), { companyId: 'B', name: 'renamed' }));
    await assertSucceeds(setDoc(doc(as('adminA'), 'triageFlows/fA'), { companyId: 'A', name: 'mine' }));
  });
  it('PM schedules are created only in the creator\'s company', async () => {
    await assertFails(addDoc(collection(as('supA'), 'pm_schedules'), { companyId: 'B', name: 'x' }));
    await assertSucceeds(addDoc(collection(as('supA'), 'pm_schedules'), { companyId: 'A', name: 'x' }));
  });
  it('PM history (PM compliance) is written only by the roles that create PM work orders', async () => {
    await assertFails(addDoc(collection(as('floorA'), 'pm_history'), { companyId: 'A', status: 'completed' }));
    await assertFails(addDoc(collection(as('techA'), 'pm_history'), { companyId: 'A', status: 'completed' }));
    await assertFails(addDoc(collection(as('supB'), 'pm_history'), { companyId: 'A', status: 'in_progress' }));
    await assertSucceeds(addDoc(collection(as('supA'), 'pm_history'), { companyId: 'A', status: 'in_progress' }));
  });
});

describe('technicians update only the breakdown tickets they work on', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await seedUser(db, 'tech2A', 'A', 'technician');
      await setDoc(doc(db, 'breakdown_tickets/bdMine'), {
        siteId: 'A', companyId: 'A', machineId: 'mA', status: 'assigned', reportedAt: new Date(2026, 0, 1),
        assignedTechnicianIds: ['techA'], attendedBy: 'techA',
      });
      await setDoc(doc(db, 'breakdown_tickets/bdWo'), {
        siteId: 'A', companyId: 'A', machineId: 'mA', status: 'assigned', reportedAt: new Date(2026, 0, 1),
        assignedTechnicianIds: [], linkedWOId: 'woA',
      });
    });
  });
  it('self-attend, assigned and linked-WO technicians keep working', async () => {
    // Self-attend a reported ticket (UnassignedBreakdownsWidget / ViewBreakdownPage).
    await assertSucceeds(updateDoc(doc(as('tech2A'), 'breakdown_tickets/bdA'), {
      assignedTechnicianIds: ['tech2A'], attendedBy: 'tech2A', status: 'assigned',
    }));
    await assertSucceeds(updateDoc(doc(as('techA'), 'breakdown_tickets/bdMine'), { severity: 'high', attemptedFixes: 'reset' }));
    // Starting / completing the linked WO advances the ticket (techA is on woA).
    await assertSucceeds(updateDoc(doc(as('techA'), 'breakdown_tickets/bdWo'), { status: 'resolved', resolvedAt: new Date() }));
    // Joining the assessment (AttendBreakdownsPage adds themselves).
    await assertSucceeds(updateDoc(doc(as('tech2A'), 'breakdown_tickets/bdMine'), { assignedTechnicianIds: arrayUnion('tech2A'), severity: 'low' }));
  });
  it('others cannot edit someone else\'s ticket or its identity', async () => {
    await assertFails(updateDoc(doc(as('tech2A'), 'breakdown_tickets/bdMine'), { status: 'closed' }));
    await assertFails(updateDoc(doc(as('tech2A'), 'breakdown_tickets/bdWo'), { status: 'resolved' }));
    await assertFails(updateDoc(doc(as('techA'), 'breakdown_tickets/bdMine'), { reportedAt: new Date() }));
    await assertFails(updateDoc(doc(as('techA'), 'breakdown_tickets/bdMine'), { machineId: 'mB' }));
    await assertFails(updateDoc(doc(as('techB'), 'breakdown_tickets/bdMine'), { assignedTechnicianIds: ['techB'] }));
    // Supervisors still manage any ticket in their company.
    await assertSucceeds(updateDoc(doc(as('supA'), 'breakdown_tickets/bdMine'), { status: 'closed' }));
  });
});

describe('notifications', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'notifications/n1'), {
      companyId: 'A', message: 'WO assigned', readBy: ['supA'], recipientUserIds: ['techA'],
    }));
  });
  it('a member marks one read for themselves only', async () => {
    await assertSucceeds(updateDoc(doc(as('techA'), 'notifications/n1'), { readBy: arrayUnion('techA') }));
    await assertFails(updateDoc(doc(as('techA'), 'notifications/n1'), { readBy: ['techA'] }));
    await assertFails(updateDoc(doc(as('techA'), 'notifications/n1'), { readBy: arrayUnion('adminA') }));
    await assertFails(updateDoc(doc(as('techA'), 'notifications/n1'), { message: 'changed' }));
    await assertFails(updateDoc(doc(as('techB'), 'notifications/n1'), { readBy: arrayUnion('techB') }));
  });
  it('new notifications start unread and stay in the sender\'s company', async () => {
    await assertSucceeds(addDoc(collection(as('techA'), 'notifications'), { companyId: 'A', message: 'x', readBy: [] }));
    await assertFails(addDoc(collection(as('techA'), 'notifications'), { companyId: 'B', message: 'x', readBy: [] }));
    await assertFails(addDoc(collection(as('techA'), 'notifications'), { companyId: 'A', message: 'x', readBy: ['adminA'] }));
  });
});
