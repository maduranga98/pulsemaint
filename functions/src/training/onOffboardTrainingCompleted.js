const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const db = getFirestore("default");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildKnowledgeReportHtml(assignment, completion) {
  const answers = (completion.assessmentAnswers || [])
    .map((qa) => `<div style="margin-bottom:10px;"><p style="font-weight:600;margin:0;">${escapeHtml(qa.question)}</p><p style="margin:2px 0 0;">${escapeHtml(qa.answer)}</p></div>`)
    .join("");

  return `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 32px; color: #1f2937;">
        <h1 style="font-size:20px;">Knowledge Transfer Report</h1>
        <p><strong>Trainee:</strong> ${escapeHtml(assignment.traineeName)}</p>
        <p><strong>Training:</strong> ${escapeHtml(assignment.moduleName)}</p>
        <p><strong>Provider:</strong> ${escapeHtml(assignment.offboardDetails?.thirdPartyCompany)} (${escapeHtml(assignment.offboardDetails?.country)})</p>
        <h2 style="font-size:16px;margin-top:24px;">Knowledge Gained</h2>
        <p>${escapeHtml(completion.knowledgeGained).replace(/\n/g, "<br/>")}</p>
        <h2 style="font-size:16px;margin-top:24px;">Assessment Q&amp;A</h2>
        ${answers || "<p>No answers provided.</p>"}
      </body>
    </html>
  `;
}

// Fires when an offboard assignment's report is submitted by the trainee —
// validates the submission, renders a "Knowledge Transfer Report" PDF,
// uploads it, marks the assignment completed, and notifies HR/supervisor.
exports.onOffboardTrainingCompleted = onDocumentUpdated(
  {database: "default", document: "trainingAssignments/{assignmentId}"},
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!after || after.category !== "offboard") return;

    const beforeSubmittedAt = before?.offboardCompletion?.reportSubmittedAt;
    const afterSubmittedAt = after?.offboardCompletion?.reportSubmittedAt;
    if (beforeSubmittedAt || !afterSubmittedAt) return; // only on newly-set submission

    const completion = after.offboardCompletion || {};
    if (!completion.knowledgeGained || completion.knowledgeGained.trim().length === 0) {
      logger.warn("Offboard completion rejected: knowledgeGained missing", {assignmentId: event.params.assignmentId});
      return;
    }

    const companyId = after.companyId || "";
    let downloadUrl = "";

    try {
      const html = buildKnowledgeReportHtml(after, completion);
      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
      try {
        const page = await browser.newPage();
        await page.setContent(html, {waitUntil: "networkidle0"});
        const pdf = await page.pdf({format: "A4", printBackground: true});
        const storagePath = `companies/${companyId}/training/offboard-reports/${event.params.assignmentId}/knowledge-transfer-report.pdf`;
        const file = getStorage().bucket().file(storagePath);
        await file.save(pdf, {contentType: "application/pdf", resumable: false});
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
        });
        downloadUrl = signedUrl;
      } finally {
        await browser.close();
      }
    } catch (err) {
      logger.error("Failed to generate offboard knowledge transfer PDF", {error: err.message, assignmentId: event.params.assignmentId});
    }

    try {
      await event.data.after.ref.update({
        "offboardCompletion.reportGeneratedPdfUrl": downloadUrl,
        status: "certified",
        completedAt: FieldValue.serverTimestamp(),
        lastActivityAt: FieldValue.serverTimestamp(),
      });

      await db.collection("companies").doc(companyId).collection("notificationLogs").add({
        type: "offboard_training_completed",
        title: "Offboard training report submitted",
        body: `${after.traineeName || "An employee"} submitted their knowledge report for "${after.moduleName || "an offboard training"}".`,
        assignmentId: event.params.assignmentId,
        targetUserIds: [after.assignedBy].filter(Boolean),
        targetRoles: ["hr_officer"],
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error("onOffboardTrainingCompleted failed to finalize", {error: err.message, assignmentId: event.params.assignmentId});
    }
  }
);
