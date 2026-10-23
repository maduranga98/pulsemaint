#!/usr/bin/env node
/**
 * Read-only readiness report for department isolation (always on — see
 * firestore.rules departmentIsolationOn).
 *
 * The rules compare the department strings on users and on work orders /
 * breakdown tickets EXACTLY, so a technician whose department is "stamping"
 * would stop seeing records filed under "Stamping". This script reports:
 *   1. department-scoped users (technician, trainee, supervisor, floor_operator)
 *      with no department, or whose department matches no machine exactly;
 *   2. departments that differ only by case / spacing (the typical cause);
 *   3. work orders and breakdown tickets with no machineDepartment (hidden
 *      from scoped roles).
 *
 * Usage:
 *   node seed/checkDepartmentIsolation.mjs --company <companyId>
 *
 * Credentials: firebase-admin application default credentials, e.g.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 * Writes nothing.
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SCOPED_ROLES = new Set(['technician', 'trainee', 'supervisor', 'floor_operator']);
const norm = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

function companyArg(argv) {
  const i = argv.indexOf('--company');
  if (i >= 0) return argv[i + 1] ?? null;
  const eq = argv.find((a) => a.startsWith('--company='));
  return eq ? eq.slice('--company='.length) : null;
}

async function main() {
  const company = companyArg(process.argv.slice(2));
  if (!company) {
    console.error('Error: --company <companyId> is required.');
    process.exit(1);
  }
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  const db = getFirestore('default');

  const [users, machines, wos, tickets] = await Promise.all([
    db.collection(`companies/${company}/users`).get(),
    db.collection('machines').where('siteId', '==', company).get(),
    db.collection('workOrders').where('siteId', '==', company).get(),
    db.collection('breakdown_tickets').where('siteId', '==', company).get(),
  ]);

  const machineDepts = new Set(machines.docs.map((d) => d.data().department).filter(Boolean));
  const machineDeptByNorm = new Map([...machineDepts].map((d) => [norm(d), d]));

  console.log(`Company ${company}: ${users.size} users, ${machines.size} machines, ${wos.size} work orders, ${tickets.size} tickets`);
  console.log(`Machine departments: ${[...machineDepts].map((d) => JSON.stringify(d)).join(', ') || '(none)'}\n`);

  let problems = 0;
  for (const doc of users.docs) {
    const u = doc.data();
    if (!SCOPED_ROLES.has(u.role) || u.status === 'inactive') continue;
    const label = `${u.fullName || doc.id} (${u.role})`;
    if (!String(u.department ?? '').trim()) {
      console.log(`- ${label}: NO department — is not restricted (sees everything in their plant) — give them a department`);
      problems++;
    } else if (!machineDepts.has(u.department)) {
      const near = machineDeptByNorm.get(norm(u.department));
      console.log(`- ${label}: department ${JSON.stringify(u.department)} matches no machine exactly${near ? ` — differs only by case/spacing from ${JSON.stringify(near)}` : ''}`);
      problems++;
    }
  }

  for (const [name, snap] of [['work orders', wos], ['breakdown tickets', tickets]]) {
    const missing = snap.docs.filter((d) => !String(d.data().machineDepartment ?? '').trim()).length;
    const off = snap.docs.filter((d) => {
      const v = d.data().machineDepartment;
      return v && !machineDepts.has(v) && machineDeptByNorm.has(norm(v));
    }).length;
    console.log(`- ${name}: ${missing} with no machineDepartment (hidden from scoped roles), ${off} whose department differs from a machine's only by case/spacing`);
    if (missing || off) problems++;
  }

  console.log(problems ? '\nFix the items above: people whose department string does not match exactly cannot see their records.' : '\nLooks consistent.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
