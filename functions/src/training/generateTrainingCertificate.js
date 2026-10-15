const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

/** Roles that may sign off someone's practical assessment. */
const SIGN_OFF_ROLES = new Set(["admin", "plant_manager", "supervisor", "maintenance_supervisor", "hr_officer", "safety_officer"]);

/**
 * Whether a move to `certified` was made legitimately:
 *  - a passed practical sign-off by a manager of the same company who is not
 *    the trainee themselves, or
 *  - a no-quiz module completed through completeTrainingAssignment
 *    (`completedVia: 'acknowledgement'`), or an offboard training whose
 *    knowledge report was accepted by onOffboardTrainingCompleted
 *    (`completedVia: 'offboard_report'`) — trainees can't write
 *    `completedVia` (firestore.rules), only the server and managers.
 * firestore.rules already stop trainees from writing the status; this is
 * the server-side backstop before an official certificate is issued.
 * @param {object} after assignment data
 * @return {Promise<boolean>} legitimate
 */
async function certificationIsLegitimate(after) {
  if (after.completedVia === "acknowledgement") return true;
  if (after.completedVia === "offboard_report") {
    return after.category === "offboard" && !!(after.offboardCompletion && after.offboardCompletion.reportSubmittedAt);
  }
  const signOff = after.practicalSignOff || {};
  if (signOff.passed !== true || !signOff.signedOffBy) return false;
  if (signOff.signedOffBy === after.traineeId) return false;
  const signer = await db.doc(`companies/${after.companyId}/users/${signOff.signedOffBy}`).get();
  if (!signer.exists) return false;
  const data = signer.data();
  return data.companyId === after.companyId && data.status !== "inactive" && SIGN_OFF_ROLES.has(data.role);
}

exports.generateTrainingCertificate = onDocumentUpdated({database: "default", document: "trainingAssignments/{assignmentId}"}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status || after.status !== "certified") return;
  // An assignment can be re-saved as 'certified' after a later status change
  // (e.g. retraining → certified again); don't mint a second certificate.
  if (after.certificateId) return;

  const companyId = after.companyId || "";
  const assignmentId = event.params.assignmentId;
  const signOff = after.practicalSignOff || {};

  if (!(await certificationIsLegitimate(after))) {
    // Never issue a certificate for a self-made "certified" status — put the
    // assignment back where it was and leave a trace for the managers.
    logger.warn("Blocked certificate for an assignment certified without a valid sign-off", {assignmentId, companyId});
    await event.data.after.ref.update({
      status: before.status || "in_progress",
      certifiedAt: before.certifiedAt ?? null,
      certificationBlockedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  const [moduleSnap, companySnap, traineeSnap, legacy] = await Promise.all([
    after.moduleId ? db.doc(`trainingModules/${after.moduleId}`).get() : null,
    companyId ? db.doc(`companies/${companyId}`).get() : null,
    // Profiles live in the per-company users subcollection.
    companyId && after.traineeId ?
      db.doc(`companies/${companyId}/users/${after.traineeId}`).get() :
      null,
    // A certificate the sign-off screen already issued under an older random id.
    db.collection("trainingCertificates")
        .where("companyId", "==", companyId)
        .where("assignmentId", "==", assignmentId)
        .limit(1)
        .get(),
  ]);
  if (!legacy.empty) {
    await event.data.after.ref.update({certificateId: legacy.docs[0].id});
    return;
  }
  const moduleData = (moduleSnap && moduleSnap.data()) || {};
  const companyData = (companySnap && companySnap.data()) || {};
  const traineeData = (traineeSnap && traineeSnap.data()) || {};

  // One certificate per assignment: the sign-off screen
  // (services/trainingCertificates.service) writes to this same id, so
  // whichever runs first creates it and the other only fills in its part.
  const certificateRef = db.collection("trainingCertificates").doc(`cert_${assignmentId}`);
  const counterRef = db.doc(`certCounters/${companyId}`);
  await db.runTransaction(async (tx) => {
    const [existing, counter] = await Promise.all([tx.get(certificateRef), tx.get(counterRef)]);
    if (existing.exists) return;
    const count = ((counter.data() || {}).count || 0) + 1;
    tx.set(counterRef, {count}, {merge: true});
    // Certificates are read by the client (and secured by firestore.rules) at
    // the top-level `trainingCertificates` collection. The document shape must
    // match TrainingCertificate in src/lib/training/trainingTypes.ts (notably
    // `isRevoked`, which the client queries on).
    tx.create(certificateRef, {
      id: certificateRef.id,
      certificateNumber: `CERT-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`,
      companyId,
      companyName: companyData.name || "",
      assignmentId,
      traineeId: after.traineeId || "",
      traineeName: after.traineeName || traineeData.fullName || "",
      traineeNic: traineeData.employeeId || "",
      traineeDesignation: traineeData.jobTitle || "",
      moduleId: after.moduleId || "",
      moduleName: after.moduleName || "",
      moduleCategory: after.moduleCategory || moduleData.moduleCategory || "machine",
      machineId: after.machineId || "",
      machineName: after.machineName || "",
      machineType: moduleData.machineTypeId || "",
      providerName: after.providerName || moduleData.providerName || "",
      issuedBy: signOff.signedOffBy || "",
      issuedByName: signOff.signedOffByName || "",
      issuedAt: FieldValue.serverTimestamp(),
      expiryDate: after.certificateExpiryDate || null,
      isExpired: false,
      quizScore: after.bestScore || 0,
      practicalObservations: signOff.observations || "",
      pdfUrl: "",
      isRevoked: false,
      revokedAt: null,
      revokedBy: null,
      revokedReason: null,
    });
  });

  await event.data.after.ref.update({
    certificateId: certificateRef.id,
    certifiedAt: after.certifiedAt || FieldValue.serverTimestamp(),
  });

  logger.info("Training certificate ready", {assignmentId, certificateId: certificateRef.id});
});
