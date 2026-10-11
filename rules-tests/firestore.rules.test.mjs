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
  it('a supervisor can sync a colleague but cannot grant admin', async () => {
    await assertSucceeds(setDoc(doc(as('supA'), 'users/techA'), { role: 'plant_manager', plantId: null }, { merge: true }));
    await assertFails(setDoc(doc(as('supA'), 'users/techA'), { role: 'admin' }, { merge: true }));
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
  it('machines: scoped reads/writes; QR visitors can still look up one machine', async () => {
    await assertSucceeds(getDocs(query(collection(as('techA'), 'machines'), where('siteId', '==', 'A'))));
    await assertFails(getDocs(query(collection(as('techB'), 'machines'), where('siteId', '==', 'A'))));
    await assertFails(getDoc(doc(as('techB'), 'machines/mA')));
    await assertFails(updateDoc(doc(as('adminB'), 'machines/mA'), { name: 'x' }));
    await assertFails(deleteDoc(doc(as('supB'), 'machines/mA')));
    await assertSucceeds(updateDoc(doc(as('supA'), 'machines/mA'), { name: 'ok', siteId: 'A', companyId: 'A' }));
    await assertSucceeds(getDoc(doc(anon(), 'machines/mA')));
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
    await assertSucceeds(addDoc(collection(anon(), 'breakdown_tickets'), {
      siteId: 'A', companyId: 'A', machineId: 'mA', source: 'qr_scan', status: 'reported', reportedBy: null, assignedTechnicianIds: [],
    }));
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
