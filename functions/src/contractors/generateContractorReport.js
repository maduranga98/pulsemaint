const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {db, FieldValue, logger} = require("./shared");
const {requireMember} = require("../lib/access");

const ALLOWED_TYPES = ["performance", "invoice", "job_history", "compliance"];

exports.generateContractorReport = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be authenticated");
  const {reportType, companyId, filters = {}} = request.data;
  if (!ALLOWED_TYPES.includes(reportType) || !companyId) {
    throw new HttpsError("invalid-argument", "Valid reportType and companyId are required");
  }
  await requireMember(request, companyId, {roles: ["admin", "plant_manager", "supervisor", "maintenance_supervisor", "hr_officer"]});

  const reportRef = db.collection("companies").doc(companyId).collection("contractorReports").doc();
  await reportRef.set({
    companyId,
    reportType,
    filters,
    status: "queued",
    requestedBy: request.auth.uid,
    requestedAt: FieldValue.serverTimestamp(),
    storageUrl: "",
  });

  logger.info("Contractor report queued", {reportId: reportRef.id, reportType, companyId});
  return {
    storageUrl: "",
    reportType,
    reportId: reportRef.id,
    status: "queued",
  };
});
