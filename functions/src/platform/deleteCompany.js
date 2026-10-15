/**
 * platformDeleteCompany — permanently erase ONE company and everything it owns.
 *
 * Superadmin only, irreversible, and scoped to the target company: every
 * query below filters on that company's id (or on the ids of its own plants),
 * and a login is only removed when its users/{uid} mapping points at this same
 * company. Other companies, their users and their roles are never touched.
 *
 * Removes: tenant documents (matched on companyId / siteId / tenantId, with
 * their subcollections), the company document and its users / invites /
 * invoices, the users/{uid} role-mapping docs, the company's logins (Firebase
 * Auth), its Storage files, and its support requests. An active Stripe
 * subscription is cancelled first so the customer is not billed again.
 *
 * Kept on purpose: the platformAuditLog entry for the deletion, Lumora's own
 * sales/expense records, and the Stripe customer + invoices (accounting).
 */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getAuth} = require("firebase-admin/auth");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const {getStripe, stripeSecretKey} = require("../billing/stripeClient");
const {isMissingResource} = require("../billing/billingAccess");
const {db, requireSuperadmin, audit} = require("./platformAccess");

// Tenant collections: documents carry the owning company's id as companyId and/or siteId.
const TENANT_COLLECTIONS = [
  "am_tasks", "analytics_daily", "analytics_monthly", "audit_drafts", "audit_logs", "audit_sessions", "audit_templates",
  "breakdown_tickets", "breakdowns", "conditionReadings", "contractorInvitations", "contractorJobs", "contractors",
  "departments", "evaluation_sessions", "evaluation_templates", "evaluations", "fives_audits", "fives_corrective_actions",
  "fives_zones", "inventoryImportSessions", "inventoryParts", "inviteTokens", "kaizen_cards", "machineHistory",
  "machine_health", "machines", "maintenanceBacklog", "moeRecalcQueue", "moeSnapshots", "notifications", "parts",
  "partReturns", "partsRequests", "permits", "plants", "pm_history", "pm_schedules", "po_notifications",
  "programAssignments", "purchaseOrders", "rca", "record_access_grants", "report_history", "report_schedules",
  "reviewHistory", "safetyCertificates", "safetyTrainingInvites", "safety_blacklist_resets", "safety_cases",
  "serviceLetterHistory", "shift_config", "shift_handovers", "shift_sessions", "shift_stats", "staff_requests",
  "stockMovements", "suppliers", "supportRequests", "technician_status", "technicians", "tpm_maturity", "tpm_pillars",
  "tpm_scores", "traineeProgrammeCertificates", "traineeProgrammes", "trainingAssignments", "trainingCertificates",
  "trainingContentLibrary", "trainingModules", "trainingPrograms", "training_records", "triageFlows", "triageSessions",
  "triageTemplates", "triage_assessment_results", "triage_assessments", "triage_categories", "triage_contacts",
  "triage_content_items", "triage_sessions", "weekendSummaries", "workOrders", "work_permit_categories", "work_permits",
  "users", "woCounters",
];
// Collections whose documents live under a company- (or plant-) keyed path
// — `<collection>/<companyId>/<sub>/…` — with no company field on the parent
// (kaizen cards, audits, 5S, TPM, AM tasks). Deleted by path.
const PATH_KEYED_COLLECTIONS = [
  "kaizen_cards", "audit_sessions", "audit_templates", "audit_drafts", "fives_zones", "fives_audits",
  "fives_corrective_actions", "tpm_pillars", "tpm_scores", "tpm_maturity", "am_tasks",
];
// One document per company, keyed by the company id.
const COMPANY_KEYED_DOCS = ["siteConfig", "inventorySettings", "shift_config", "moeConfig", "traineeProgrammeCertCounters", "certCounters"];
/** Documents deleted in parallel. */
const DELETE_CONCURRENCY = 25;
const TENANT_FIELDS = ["companyId", "siteId", "tenantId"];
// Storage roots keyed by company id, and roots keyed by plant id (see storage.rules).
const STORAGE_COMPANY_ROOTS = ["companies", "workorders", "breakdowns", "evaluation_attachments", "safetyTrainingSubmissions", "triage", "reports"];
const STORAGE_PLANT_ROOTS = ["audit_attachments", "audit_reports", "audits", "kaizen"];

/** Delete every file under `prefix` — always a `<root>/<this company or plant id>/` folder, never a bare root. */
async function deleteStoragePrefix(prefix) {
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/$/.test(prefix)) throw new Error(`Refusing to delete unscoped Storage prefix "${prefix}"`);
  try {
    await getStorage().bucket().deleteFiles({prefix, force: true});
  } catch (err) {
    logger.warn(`Storage cleanup failed for ${prefix}`, err);
  }
}

exports.platformDeleteCompany = onCall(
    {secrets: [stripeSecretKey], timeoutSeconds: 540, memory: "1GiB"},
    async (request) => {
      const actor = requireSuperadmin(request);
      const {companyId, confirmName} = request.data ?? {};
      if (typeof companyId !== "string" || !/^[A-Za-z0-9_-]{6,}$/.test(companyId)) {
        throw new HttpsError("invalid-argument", "A valid companyId is required");
      }

      const ref = db.collection("companies").doc(companyId);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Company not found");
      const company = snap.data();
      const name = String(company.name ?? "").trim();
      if (!name || String(confirmName ?? "").trim() !== name) {
        throw new HttpsError("failed-precondition", "Type the company name exactly to confirm the deletion");
      }

      await audit(actor, "company.delete.started", {companyId, companyName: name});

      // 1. Stop billing first — if this fails nothing has been deleted yet. A
      // re-run after a timeout finds the subscription already cancelled.
      if (company.stripeSubscriptionId) {
        try {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
          if (sub.status !== "canceled") await stripe.subscriptions.cancel(company.stripeSubscriptionId);
        } catch (err) {
          if (!isMissingResource(err) && err?.code !== "resource_missing") {
            logger.error("Could not cancel the Stripe subscription before deleting the company", err);
            throw new HttpsError("internal", "Could not cancel the Stripe subscription — nothing was deleted");
          }
        }
      }

      // 2. Work out which logins belong to THIS company, before profiles go away.
      const candidateUids = new Set();
      const [profiles, mappings] = await Promise.all([
        db.collection(`companies/${companyId}/users`).get(),
        db.collection("users").where("companyId", "==", companyId).get(),
      ]);
      profiles.docs.forEach((d) => candidateUids.add(d.id));
      mappings.docs.forEach((d) => candidateUids.add(d.id));
      if (company.adminUserId) candidateUids.add(company.adminUserId);
      candidateUids.delete(actor.uid); // never remove the superadmin running this

      const ownUids = [];
      for (const uid of candidateUids) {
        const mapping = await db.collection("users").doc(uid).get();
        // A login mapped to a different company is someone else's — leave it alone.
        if (mapping.exists && mapping.get("companyId") && mapping.get("companyId") !== companyId) continue;
        ownUids.push(uid);
      }

      const plantIds = new Set();
      (await db.collection("plants").where("companyId", "==", companyId).get()).docs.forEach((d) => plantIds.add(d.id));
      // Needed after their documents are gone: machine history lives under
      // machineHistory/{machineId}/entries (no company field), and scheduled
      // report files under report_schedules/{scheduleId}/ in Storage.
      const machineIds = (await db.collection("machines").where("siteId", "==", companyId).select().get()).docs.map((d) => d.id);
      const reportScheduleIds = (await db.collection("report_schedules").where("companyId", "==", companyId).select().get())
          .docs.map((d) => d.id);

      // 3. Tenant documents (with their subcollections).
      const writer = db.bulkWriter();
      writer.onWriteError((e) => {
        logger.warn(`Delete failed for ${e.documentRef.path}`, e);
        return e.failedAttempts < 3;
      });
      let deleted = 0;
      const seen = new Set();
      // Many documents at once — one at a time could not finish a large
      // company inside the time limit.
      const deleteRefs = async (refs) => {
        for (let i = 0; i < refs.length; i += DELETE_CONCURRENCY) {
          await Promise.all(refs.slice(i, i + DELETE_CONCURRENCY).map((r) => db.recursiveDelete(r, writer)));
        }
      };
      for (const col of TENANT_COLLECTIONS) {
        for (const field of TENANT_FIELDS) {
          let docs;
          try {
            docs = await db.collection(col).where(field, "==", companyId).select().get();
          } catch (err) {
            continue; // collection/field combination that doesn't exist
          }
          const refs = docs.docs.map((d) => d.ref).filter((r) => !seen.has(r.path));
          refs.forEach((r) => seen.add(r.path));
          await deleteRefs(refs);
          deleted += refs.length;
        }
      }
      await deleteRefs(COMPANY_KEYED_DOCS.map((col) => db.collection(col).doc(companyId)).filter((r) => !seen.has(r.path)));
      await deleteRefs(machineIds.map((id) => db.collection("machineHistory").doc(id)));
      // Path-keyed modules: keyed by the company id (and, for some, a plant id).
      await deleteRefs(PATH_KEYED_COLLECTIONS.flatMap((col) =>
        [companyId, ...plantIds].map((key) => db.collection(col).doc(key))));
      await writer.flush();

      // 4. Storage files — only this company's and its plants' folders.
      await Promise.all([
        ...STORAGE_COMPANY_ROOTS.map((root) => deleteStoragePrefix(`${root}/${companyId}/`)),
        ...[companyId, ...plantIds].flatMap((pid) => STORAGE_PLANT_ROOTS.map((root) => deleteStoragePrefix(`${root}/${pid}/`))),
        ...reportScheduleIds.map((id) => deleteStoragePrefix(`report_schedules/${id}/`)),
      ]);

      // 5. Logins — skip anyone holding the superadmin claim.
      const toRemove = [];
      for (let i = 0; i < ownUids.length; i += 100) {
        const res = await getAuth().getUsers(ownUids.slice(i, i + 100).map((uid) => ({uid})));
        for (const u of res.users) {
          if (u.customClaims?.superadmin === true) continue;
          toRemove.push(u.uid);
        }
      }
      let loginsDeleted = 0;
      for (let i = 0; i < toRemove.length; i += 1000) {
        const res = await getAuth().deleteUsers(toRemove.slice(i, i + 1000));
        loginsDeleted += res.successCount;
      }

      // 6. The company itself (its users, invites and invoices are subcollections).
      await db.recursiveDelete(ref);

      await audit(actor, "company.delete", {companyId, companyName: name, documentsDeleted: deleted, loginsDeleted});
      logger.info(`Company ${companyId} (${name}) permanently deleted by ${actor.email}`);
      return {ok: true, documentsDeleted: deleted, loginsDeleted};
    },
);
