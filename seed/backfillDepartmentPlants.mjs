#!/usr/bin/env node
/**
 * One-off migration: split each company-wide `departments` document into
 * one per plant, so a department name is no longer shared across plants.
 *
 * Why: `departments` docs used to only carry `companyId` + `name` — the same
 * "Maintenance" doc served every plant, so users/machines/etc. in different
 * plants with the same department name were indistinguishable. Departments
 * are now a sub-category of plant (`useDepartments` queries by
 * `companyId` + `plantId`), so every doc needs a `plantId`.
 *
 * Strategy ("clone per plant"): for each legacy department doc (no
 * `plantId`), look at which plants actually have users or machines
 * registered under that department name, and create one new department doc
 * per (plant, name) pair. If nothing currently references a name in any
 * plant, it's left as an orphaned legacy doc (reported, not touched) rather
 * than guessed at. The original company-wide doc is deleted once its clones
 * exist, unless --keep-legacy is passed.
 *
 * This does NOT rewrite the department string on users/machines/work orders
 * themselves (that string already matches by name, and users/machines carry
 * their own plantId separately) — it only fixes up the `departments`
 * collection used to populate department pickers.
 *
 * Safe to re-run: a name that already has a plantId-tagged doc for a given
 * plant is skipped for that plant.
 *
 * Usage:
 *   node seed/backfillDepartmentPlants.mjs --company <companyId> [--dry-run] [--keep-legacy]
 *
 *   --company      REQUIRED. Only this companyId's departments are touched.
 *   --dry-run      Print what would change and exit without writing.
 *   --keep-legacy  Don't delete the original company-wide doc after cloning.
 *
 * Credentials: uses firebase-admin's application default credentials, e.g.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function parseArgs(argv) {
  const args = { company: null, dryRun: false, keepLegacy: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--keep-legacy') args.keepLegacy = true;
    else if (arg === '--company') args.company = argv[++i] ?? null;
    else if (arg.startsWith('--company=')) args.company = arg.slice('--company='.length);
  }
  return args;
}

async function main() {
  const { company, dryRun, keepLegacy } = parseArgs(process.argv.slice(2));

  if (!company) {
    console.error('Error: --company <companyId> is required.');
    console.error('Usage: node seed/backfillDepartmentPlants.mjs --company <companyId> [--dry-run] [--keep-legacy]');
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();

  const [deptSnap, usersSnap, machinesSnap] = await Promise.all([
    db.collection('departments').where('companyId', '==', company).get(),
    db.collection(`companies/${company}/users`).get(),
    db.collection('machines').where('companyId', '==', company).get(),
  ]);

  const legacyDepts = deptSnap.docs.filter((d) => !d.data().plantId);
  const alreadyScoped = new Set(
    deptSnap.docs
      .filter((d) => d.data().plantId)
      .map((d) => `${d.data().plantId}::${d.data().name}`),
  );

  // name -> Set<plantId>, derived from who's actually using that name today.
  const nameToPlants = new Map();
  const addUsage = (name, plantId) => {
    if (!name || !plantId) return;
    if (!nameToPlants.has(name)) nameToPlants.set(name, new Set());
    nameToPlants.get(name).add(plantId);
  };
  for (const doc of usersSnap.docs) {
    const d = doc.data();
    addUsage(d.department, d.plantId);
  }
  for (const doc of machinesSnap.docs) {
    const d = doc.data();
    addUsage(d.department, d.plantId);
  }

  console.log(`company:              ${company}`);
  console.log(`legacy department docs: ${legacyDepts.length} (of ${deptSnap.size} total)`);

  if (legacyDepts.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const toCreate = []; // { name, plantId }
  const toDeleteLegacy = [];
  const orphaned = [];

  for (const doc of legacyDepts) {
    const name = doc.data().name;
    const plants = nameToPlants.get(name);
    if (!plants || plants.size === 0) {
      orphaned.push(name);
      continue;
    }
    for (const plantId of plants) {
      const key = `${plantId}::${name}`;
      if (!alreadyScoped.has(key)) toCreate.push({ name, plantId });
    }
    toDeleteLegacy.push(doc);
  }

  console.log(`clones to create:     ${toCreate.length}`);
  console.log(`legacy docs to remove: ${toDeleteLegacy.length}${keepLegacy ? ' (skipped: --keep-legacy)' : ''}`);
  console.log(`orphaned (no plant usage found, left untouched): ${orphaned.length}`);
  if (orphaned.length > 0) {
    console.log('  ' + orphaned.slice(0, 20).join(', ') + (orphaned.length > 20 ? ', …' : ''));
  }

  if (dryRun) {
    console.log('\n--dry-run: no writes made.');
    for (const c of toCreate.slice(0, 20)) console.log(`  + ${c.name} @ plant ${c.plantId}`);
    if (toCreate.length > 20) console.log(`  … and ${toCreate.length - 20} more`);
    return;
  }

  const BATCH_SIZE = 400;
  let created = 0;
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const c of toCreate.slice(i, i + BATCH_SIZE)) {
      const ref = db.collection('departments').doc();
      batch.set(ref, {
        companyId: company,
        plantId: c.plantId,
        name: c.name,
        createdAt: new Date(),
      });
    }
    await batch.commit();
    created += Math.min(BATCH_SIZE, toCreate.length - i);
    console.log(`created ${created}/${toCreate.length}`);
  }

  if (!keepLegacy) {
    let deleted = 0;
    for (let i = 0; i < toDeleteLegacy.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const doc of toDeleteLegacy.slice(i, i + BATCH_SIZE)) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      deleted += Math.min(BATCH_SIZE, toDeleteLegacy.length - i);
      console.log(`removed legacy ${deleted}/${toDeleteLegacy.length}`);
    }
  }

  console.log(`Done. Created ${created} plant-scoped department doc(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
