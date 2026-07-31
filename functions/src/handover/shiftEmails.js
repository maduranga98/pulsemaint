const {onDocumentWritten, onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {db, FieldValue, logger, addNotification} = require("./shared");
const {brandedEmail, sendEmail} = require("../lib/mailer");

// ---------------------------------------------------------------------------
// Recipient resolution — a user belongs to a shift plan when they are in the
// member list, their users/{id}.shiftId points at the plan, or their role is
// one of the plan's scheduled roles.
// ---------------------------------------------------------------------------

async function resolveShiftRecipients(configId, shift) {
  const usersSnap = await db
      .collection("users")
      .where("companyId", "==", shift.companyId)
      .get();
  const memberIds = shift.memberIds || [];
  const roles = shift.roles || [];
  return usersSnap.docs
      .map((doc) => ({id: doc.id, ...doc.data()}))
      .filter((user) => user.status !== "inactive")
      .filter((user) =>
        memberIds.includes(user.id) ||
        user.shiftId === configId ||
        roles.includes(user.role))
      .filter((user) => Boolean(user.email));
}

function describeShift(shift) {
  const days = (shift.activeDays || []).join(", ");
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;margin:20px 0;">
  <tr><td style="padding:16px 20px;">
    <table>
      <tr><td style="color:#888;font-size:13px;padding-right:12px;white-space:nowrap;">Shift:</td><td style="color:#333;font-size:13px;font-weight:600;">${shift.shiftName || "Shift"}</td></tr>
      <tr><td style="color:#888;font-size:13px;padding-right:12px;padding-top:6px;">Time:</td><td style="color:#333;font-size:13px;font-weight:500;padding-top:6px;">${shift.startTime || "?"} – ${shift.endTime || "?"}</td></tr>
      <tr><td style="color:#888;font-size:13px;padding-right:12px;padding-top:6px;">Days:</td><td style="color:#333;font-size:13px;font-weight:500;padding-top:6px;">${days || "-"}</td></tr>
      ${shift.department ? `<tr><td style="color:#888;font-size:13px;padding-right:12px;padding-top:6px;">Department:</td><td style="color:#333;font-size:13px;font-weight:500;padding-top:6px;">${shift.department}</td></tr>` : ""}
      <tr><td style="color:#888;font-size:13px;padding-right:12px;padding-top:6px;">Status:</td><td style="color:#333;font-size:13px;font-weight:500;padding-top:6px;text-transform:capitalize;">${shift.status || "active"}</td></tr>
    </table>
  </td></tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Shift plan updated — email everyone scheduled on the plan
// ---------------------------------------------------------------------------

const PLAN_FIELDS = ["shiftName", "startTime", "endTime", "activeDays", "department", "status", "memberIds", "roles"];

function planChanged(before, after) {
  if (!before || !after) return true;
  return PLAN_FIELDS.some((field) =>
    JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null));
}

exports.onShiftPlanUpdated = onDocumentWritten(
    {database: "default", document: "shift_config/{configId}"},
    async (event) => {
      const before = event.data.before.exists ? event.data.before.data() : null;
      const after = event.data.after.exists ? event.data.after.data() : null;
      if (!planChanged(before, after)) return;

      const configId = event.params.configId;
      const shift = after || before;
      const action = !before ? "created" : (!after ? "removed" : "updated");

      // Union of before/after recipients so removed members are told too.
      const recipients = new Map();
      for (const source of [before, after]) {
        if (!source) continue;
        const users = await resolveShiftRecipients(configId, source);
        for (const user of users) recipients.set(user.id, user);
      }
      if (recipients.size === 0) {
        logger.info(`Shift plan ${action}, no email recipients`, {configId});
        return;
      }

      const shiftName = shift.shiftName || "Shift";
      const subject = `Shift plan ${action}: ${shiftName}`;
      let sent = 0;
      for (const user of recipients.values()) {
        const body = `
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:600;">Shift plan ${action}</h2>
<p style="margin:0 0 8px;color:#555;font-size:15px;line-height:1.6;">
  Hi ${user.fullName || "there"}, the shift plan <strong>${shiftName}</strong> you are scheduled on has been ${action}.
</p>
${after ? describeShift(after) : describeShift(before)}
<p style="margin:0;color:#888;font-size:13px;">
  Open FirmiCore → <strong>My Shift</strong> to see your current shift plans.
</p>`;
        const ok = await sendEmail({
          to: user.email,
          subject,
          html: brandedEmail(body),
          text: `The shift plan ${shiftName} has been ${action}. ${shift.startTime || ""} - ${shift.endTime || ""}. Check FirmiCore → My Shift for details.`,
        });
        if (ok) sent += 1;
      }

      await addNotification(shift.companyId, {
        type: "shift_plan_updated",
        title: `Shift plan ${action}`,
        body: `${shiftName} (${shift.startTime || "?"} - ${shift.endTime || "?"}) was ${action}.`,
        targetUserIds: Array.from(recipients.keys()),
        shiftConfigId: configId,
      });

      logger.info(`Shift plan ${action} — emails sent`, {configId, sent, recipients: recipients.size});
    });

// ---------------------------------------------------------------------------
// Handover submitted — tell the incoming supervisors there is a shift
// briefing waiting for acceptance. (The client writes shift_handovers
// directly, so this trigger fires for every submission path.)
// ---------------------------------------------------------------------------

exports.onHandoverSubmitted = onDocumentCreated(
    {database: "default", document: "shift_handovers/{handoverId}"},
    async (event) => {
      const handover = event.data.data();
      if (!handover || !handover.companyId || handover.status !== "pending_acceptance") return;

      const usersSnap = await db
          .collection("users")
          .where("companyId", "==", handover.companyId)
          .get();
      const recipients = usersSnap.docs
          .map((doc) => ({id: doc.id, ...doc.data()}))
          .filter((user) => user.status !== "inactive")
          .filter((user) => ["supervisor", "admin", "maintenance_supervisor"].includes(user.role))
          .filter((user) => user.id !== handover.outgoingSupervisorId)
          .filter((user) => Boolean(user.email));

      for (const user of recipients) {
        const body = `
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:600;">Shift handover awaiting acceptance</h2>
<p style="margin:0 0 8px;color:#555;font-size:15px;line-height:1.6;">
  Hi ${user.fullName || "there"}, <strong>${handover.outgoingSupervisorName || "The outgoing supervisor"}</strong>
  has ended the <strong>${handover.shiftName || "shift"}</strong> and submitted a handover briefing.
  Please review and accept it to take over the shift.
</p>
<p style="margin:0;color:#888;font-size:13px;">
  Open FirmiCore → <strong>Shift Briefing</strong> to accept the handover.
</p>`;
        await sendEmail({
          to: user.email,
          subject: `Handover pending: ${handover.shiftName || "Shift"} (${handover.shiftDate || ""})`,
          html: brandedEmail(body),
          text: `${handover.outgoingSupervisorName || "The outgoing supervisor"} submitted a handover for ${handover.shiftName || "the shift"}. Review it in FirmiCore.`,
        });
      }

      if (recipients.length > 0) {
        await addNotification(handover.companyId, {
          type: "shift_handover_submitted",
          title: "Shift handover pending",
          body: `${handover.shiftName || "Shift"} handover is waiting for acceptance.`,
          targetUserIds: recipients.map((user) => user.id),
          handoverId: event.params.handoverId,
        });
      }

      logger.info("Handover-submitted emails sent", {handoverId: event.params.handoverId, count: recipients.length});
    });

// ---------------------------------------------------------------------------
// Pre-shift reminders — email members 2–3 hours before their shift starts
// ---------------------------------------------------------------------------

function timeToMinutes(time) {
  const [hours, minutes] = String(time || "0:0").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** Local wall-clock parts for `date` in the given IANA timezone. */
function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(date);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value;
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"), // "Mon".."Sun" — matches ShiftDay labels
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

/**
 * Minutes until the next start of this shift in the company timezone, plus
 * the local date of that occurrence. Returns null when the shift doesn't run
 * today/tomorrow.
 */
function minutesUntilNextStart(shift, timeZone, now = new Date()) {
  const today = localParts(now, timeZone);
  const startMinutes = timeToMinutes(shift.startTime);
  const activeDays = shift.activeDays || [];

  if (startMinutes >= today.minutes && activeDays.includes(today.weekday)) {
    return {minutes: startMinutes - today.minutes, dateStr: today.dateStr};
  }
  // Next occurrence would be tomorrow.
  const tomorrow = localParts(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone);
  if (activeDays.includes(tomorrow.weekday)) {
    return {minutes: 24 * 60 - today.minutes + startMinutes, dateStr: tomorrow.dateStr};
  }
  return null;
}

exports.sendShiftStartReminders = onSchedule("every 30 minutes", async () => {
  const configsSnap = await db.collection("shift_config").where("status", "==", "active").get();
  if (configsSnap.empty) return;

  // Cache company timezones.
  const tzByCompany = new Map();
  async function companyTz(companyId) {
    if (!tzByCompany.has(companyId)) {
      const snap = await db.collection("companies").doc(companyId).get();
      tzByCompany.set(companyId, (snap.exists && snap.data().timezone) || "UTC");
    }
    return tzByCompany.get(companyId);
  }

  let remindersSent = 0;
  for (const doc of configsSnap.docs) {
    const shift = doc.data();
    if (!shift.companyId) continue;

    let timeZone = "UTC";
    let next = null;
    try {
      timeZone = await companyTz(shift.companyId);
      next = minutesUntilNextStart(shift, timeZone);
    } catch (err) {
      logger.error(`Failed to evaluate reminder window for shift ${doc.id}`, err);
      continue;
    }
    // Remind once when the shift starts within the next 2–3 hours.
    if (!next || next.minutes < 120 || next.minutes > 180) continue;

    // Dedupe: one reminder per shift per local start date.
    const markerRef = db.collection("shift_reminders").doc(`${doc.id}_${next.dateStr}`);
    const marker = await markerRef.get();
    if (marker.exists) continue;
    await markerRef.set({
      companyId: shift.companyId,
      shiftConfigId: doc.id,
      shiftDate: next.dateStr,
      sentAt: FieldValue.serverTimestamp(),
    });

    const recipients = await resolveShiftRecipients(doc.id, shift);
    const hours = Math.round((next.minutes / 60) * 10) / 10;
    for (const user of recipients) {
      const body = `
<h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:600;">Your shift starts soon</h2>
<p style="margin:0 0 8px;color:#555;font-size:15px;line-height:1.6;">
  Hi ${user.fullName || "there"}, a reminder that your shift <strong>${shift.shiftName || "Shift"}</strong>
  starts in about <strong>${hours} hours</strong> (at ${shift.startTime}).
</p>
${describeShift(shift)}
<p style="margin:0;color:#888;font-size:13px;">
  When you arrive, open FirmiCore → <strong>My Shift</strong> and press <strong>Start Shift</strong>.
</p>`;
      const ok = await sendEmail({
        to: user.email,
        subject: `Reminder: ${shift.shiftName || "Your shift"} starts at ${shift.startTime}`,
        html: brandedEmail(body),
        text: `Reminder: your shift ${shift.shiftName || ""} starts at ${shift.startTime} (in about ${hours} hours).`,
      });
      if (ok) remindersSent += 1;
    }

    if (recipients.length > 0) {
      await addNotification(shift.companyId, {
        type: "shift_start_reminder",
        title: "Shift starting soon",
        body: `${shift.shiftName || "Shift"} starts at ${shift.startTime}.`,
        targetUserIds: recipients.map((user) => user.id),
        shiftConfigId: doc.id,
      });
    }
  }

  logger.info("Shift start reminders processed", {remindersSent});
});
