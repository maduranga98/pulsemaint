const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {requireMember} = require("../lib/access");

const db = getFirestore("default");

exports.generateComplianceReportPdf = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  const {companyId, filters = {}} = request.data || {};
  if (!companyId) throw new HttpsError("invalid-argument", "companyId is required.");
  await requireMember(request, companyId, {roles: ["admin", "plant_manager", "supervisor", "maintenance_supervisor", "hr_officer", "safety_officer"]});

  const reportRef = await db.collection("companies").doc(companyId).collection("reports").add({
    type: "training_compliance",
    status: "queued",
    filters,
    requestedBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {reportId: reportRef.id, status: "queued"};
});
