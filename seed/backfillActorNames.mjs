#!/usr/bin/env node
/**
 * One-off backfill: rewrite every actor "*Name" field on `breakdown_tickets`
 * and `workOrders` documents (status history entries, attendedByName,
 * assignedTechnicianNames, supervisorSignOffByName, closedByName,
 * checkedInByName, uploadedByName on documents/completion docs) using the
 * paired uid field looked up against `users/{uid}.fullName`.
 *
 * Why: before this fix, several write paths stamped the actor name from
 * Firebase Auth's `displayName` (often unset, or defaulting to the sign-in
 * email/a garbage value) instead of the registered profile's `fullName`.
 * That produced entries like "assignmentwriting" in status history. The
 * code fix only prevents *new* writes from doing this — documents written
 * before the fix still have the bad name baked into their arrays, since
 * Firestore doesn't let you patch one element of an array field in place.
 * This script re-resolves every actor uid already on file and rewrites the
 * whole array/field with the corrected name.
 *
 * Safe to re-run: skips fields whose resolved name already matches.
 *
 * Usage:
 *   node seed/backfillActorNames.mjs --company <companyId> [--dry-run]
 *
 *   --company   REQUIRED. Only documents belonging to this companyId are
 *               considered, so one tenant can be migrated at a time.
 *   --dry-run   Print what would change and exit without writing.
 *
 * Credentials: uses firebase-admin's application default credentials, e.g.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = { company: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--company') args.company = argv[++i] ?? null;
    else if (arg.startsWith('--company=')) args.company = arg.slice('--company='.length);
  }
  return args;
}

/** Resolve every uid referenced anywhere in `docs` to its current
 *  users/{uid}.fullName, batching the `in` lookups at 30 ids each. */
async function resolveNames(db, uids) {
  const ids = Array.from(uids).filter(Boolean);
  const names = new Map();
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const snap = await db.collection('users').where('__name__', 'in', chunk).get();
    snap.docs.forEach((d) => {
      const fullName = d.data().fullName;
      if (fullName) names.set(d.id, fullName);
    });
  }
  return names;
}

function collectUids(data) {
  const uids = new Set();
  const single = [
    'attendedBy', 'assignedBy', 'changedBy', 'reportedBy', 'cancelledBy',
    'supervisorSignOffBy', 'closedBy', 'checkedInBy', 'createdBy', 'requestedBy', 'uploadedBy',
  ];
  for (const key of single) {
    if (typeof data[key] === 'string') uids.add(data[key]);
  }
  if (Array.isArray(data.assignedTechnicianIds)) {
    data.assignedTechnicianIds.forEach((id) => uids.add(id));
  }
  for (const arrKey of ['statusHistory', 'documents', 'partsRequests']) {
    if (Array.isArray(data[arrKey])) {
      data[arrKey].forEach((entry) => {
        if (entry && typeof entry.changedBy === 'string') uids.add(entry.changedBy);
        if (entry && typeof entry.uploadedBy === 'string') uids.add(entry.uploadedBy);
        if (entry && typeof entry.requestedBy === 'string') uids.add(entry.requestedBy);
      });
    }
  }
  return uids;
}

/** Returns the field updates for one document, or null if nothing changed. */
function buildUpdate(data, names) {
  const updates = {};
  let changed = false;

  const setIfChanged = (key, newValue) => {
    if (newValue != null && data[key] !== newValue) {
      updates[key] = newValue;
      changed = true;
    }
  };

  if (data.attendedBy) setIfChanged('attendedByName', names.get(data.attendedBy));
  if (data.assignedBy) setIfChanged('assignedByName', names.get(data.assignedBy));
  if (data.cancelledBy) setIfChanged('cancelledByName', names.get(data.cancelledBy));
  if (data.supervisorSignOffBy) setIfChanged('supervisorSignOffByName', names.get(data.supervisorSignOffBy));
  if (data.closedBy) setIfChanged('closedByName', names.get(data.closedBy));
  if (data.checkedInBy) setIfChanged('checkedInByName', names.get(data.checkedInBy));

  if (Array.isArray(data.assignedTechnicianIds) && data.assignedTechnicianIds.length > 0) {
    const resolved = data.assignedTechnicianIds.map((id, i) => names.get(id) ?? data.assignedTechnicianNames?.[i] ?? '');
    if (JSON.stringify(resolved) !== JSON.stringify(data.assignedTechnicianNames ?? [])) {
      updates.assignedTechnicianNames = resolved;
      changed = true;
    }
  }

  if (Array.isArray(data.statusHistory) && data.statusHistory.length > 0) {
    const resolved = data.statusHistory.map((entry) => {
      if (entry && typeof entry.changedBy === 'string' && names.has(entry.changedBy)) {
        const correct = names.get(entry.changedBy);
        if (entry.changedByName !== correct) return { ...entry, changedByName: correct };
      }
      return entry;
    });
    if (JSON.stringify(resolved) !== JSON.stringify(data.statusHistory)) {
      updates.statusHistory = resolved;
      changed = true;
    }
  }

  if (Array.isArray(data.documents) && data.documents.length > 0) {
    const resolved = data.documents.map((doc) => {
      if (doc && typeof doc.uploadedBy === 'string' && names.has(doc.uploadedBy)) {
        const correct = names.get(doc.uploadedBy);
        if (doc.uploadedByName !== correct) return { ...doc, uploadedByName: correct };
      }
      return doc;
    });
    if (JSON.stringify(resolved) !== JSON.stringify(data.documents)) {
      updates.documents = resolved;
      changed = true;
    }
  }

  return changed ? updates : null;
}

async function migrateCollection(db, collectionName, company, dryRun) {
  const snap = await db.collection(collectionName).where('companyId', '==', company).get();
  console.log(`\n${collectionName}: scanned ${snap.size} document(s)`);

  const allUids = new Set();
  snap.docs.forEach((d) => collectUids(d.data()).forEach((uid) => allUids.add(uid)));
  const names = await resolveNames(db, allUids);
  console.log(`${collectionName}: resolved ${names.size}/${allUids.size} actor uid(s) to a fullName`);

  const toUpdate = [];
  for (const d of snap.docs) {
    const update = buildUpdate(d.data(), names);
    if (update) toUpdate.push({ ref: d.ref, update, id: d.id });
  }

  console.log(`${collectionName}: ${toUpdate.length} document(s) need a fix`);
  if (toUpdate.length === 0) return;

  if (dryRun) {
    for (const { id, update } of toUpdate.slice(0, 20)) {
      console.log(`  would update ${id}: ${Object.keys(update).join(', ')}`);
    }
    if (toUpdate.length > 20) console.log(`  … and ${toUpdate.length - 20} more`);
    return;
  }

  let written = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const { ref, update } of toUpdate.slice(i, i + BATCH_SIZE)) {
      batch.update(ref, update);
    }
    await batch.commit();
    written += Math.min(BATCH_SIZE, toUpdate.length - i);
    console.log(`${collectionName}: updated ${written}/${toUpdate.length}`);
  }
}

async function main() {
  const { company, dryRun } = parseArgs(process.argv.slice(2));

  if (!company) {
    console.error('Error: --company <companyId> is required.');
    console.error('Usage: node seed/backfillActorNames.mjs --company <companyId> [--dry-run]');
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();

  await migrateCollection(db, 'breakdown_tickets', company, dryRun);
  await migrateCollection(db, 'workOrders', company, dryRun);

  console.log(dryRun ? '\n--dry-run complete, nothing written.' : '\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
