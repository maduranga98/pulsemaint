const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

exports.generateTrainingCertificate = onDocumentUpdated({ database: "default", document: "trainingAssignments/{assignmentId}" }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status || after.status !== "certified") return;
  // An assignment can be re-saved as 'certified' after a later status change
  // (e.g. retraining → certified again); don't mint a second certificate.
  if (after.certificateId) return;

  const companyId = after.companyId || "";
  const assignmentId = event.params.assignmentId;
  const signOff = after.practicalSignOff || {};

  const [moduleSnap, companySnap, traineeSnap] = await Promise.all([
    after.moduleId ? db.doc(`trainingModules/${after.moduleId}`).get() : null,
    companyId ? db.doc(`companies/${companyId}`).get() : null,
    // Profiles live in the per-company users subcollection.
    companyId && after.traineeId ?
      db.doc(`companies/${companyId}/users/${after.traineeId}`).get() :
      null,
  ]);
  const moduleData = (moduleSnap && moduleSnap.data()) || {};
  const companyData = (companySnap && companySnap.data()) || {};
  const traineeData = (traineeSnap && traineeSnap.data()) || {};

  const counterRef = db.doc(`certCounters/${companyId}`);
  const certificateNumber = await db.runTransaction(async (tx) => {
    const counter = await tx.get(counterRef);
    const count = ((counter.data() || {}).count || 0) + 1;
    tx.set(counterRef, {count}, {merge: true});
    return `CERT-${new Date().getFullYear()}-${String(count).padStart(4, "0")}`;
  });

  // Certificates are read by the client (and secured by firestore.rules) at
  // the top-level `trainingCertificates` collection — writing them into
  // companies/{id}/trainingCertificates meant no trainee or manager ever saw
  // the certificate that had been generated for them. The document shape must
  // match TrainingCertificate in src/lib/training/trainingTypes.ts (notably
  // `isRevoked`, which the client queries on).
  const certificateRef = db.collection("trainingCertificates").doc();
  await certificateRef.set({
    id: certificateRef.id,
    certificateNumber,
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

  await event.data.after.ref.update({
    certificateId: certificateRef.id,
    certifiedAt: after.certifiedAt || FieldValue.serverTimestamp(),
  });

  logger.info("Generated training certificate", {assignmentId, certificateNumber});
});
