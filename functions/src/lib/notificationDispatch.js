/**
 * Shared notification dispatch helper.
 *
 * Reads each recipient's per-user notification preferences
 * (users/{uid}.notificationPrefs) and skips channels (push / email) the user
 * has disabled. Falls back to sensible defaults when a user has no stored
 * prefs: push+email for high-severity events, push-only for the rest.
 */

const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");

let _mailer = null;
function getMailer() {
  if (_mailer) return _mailer;
  try {
    const nodemailer = require("nodemailer");
    _mailer = nodemailer.createTransport({
      host: "mail.spacemail.com",
      port: 465,
      secure: true,
      auth: { user: "hello@feedsolve.com", pass: "2_qY5u9z" },
    });
  } catch (err) {
    logger.warn("Email transport unavailable", err);
    _mailer = null;
  }
  return _mailer;
}

// Must mirror src/types/notificationPrefs.ts. High-severity → push+email.
const EVENT_DEFAULTS = {
  breakdown: { push: true, email: true },
  slaBreach: { push: true, email: true },
  safetyAlert: { push: true, email: true },
  woAssigned: { push: true, email: false },
  mention: { push: true, email: false },
  lowStock: { push: true, email: false },
  pmDue: { push: true, email: false },
  partsRequest: { push: true, email: false },
  handover: { push: true, email: false },
};

/** Resolve which channels are enabled for a user + event type. */
function resolveChannels(userData, eventType) {
  const fallback = EVENT_DEFAULTS[eventType] || { push: true, email: false };
  const prefs = userData && userData.notificationPrefs;
  const pref = prefs && prefs[eventType];
  if (!pref) return { push: !!fallback.push, email: !!fallback.email };
  return { push: !!pref.push, email: !!pref.email };
}

function collectTokens(userData) {
  const tokens = [];
  if (userData.fcmToken) tokens.push(userData.fcmToken);
  if (Array.isArray(userData.fcmTokens)) {
    for (const t of userData.fcmTokens) if (t) tokens.push(t);
  }
  return Array.from(new Set(tokens));
}

async function sendPush(tokens, title, body, data) {
  if (!tokens.length) return;
  try {
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: data || {},
    });
  } catch (err) {
    logger.error("FCM push failed", err);
  }
}

async function sendEmail(to, subject, html) {
  const mailer = getMailer();
  if (!mailer || !to) return;
  try {
    await mailer.sendMail({
      from: '"PulseMaint" <hello@feedsolve.com>',
      to,
      subject,
      html: html || `<p>${subject}</p>`,
    });
  } catch (err) {
    logger.error("Email send failed", err);
  }
}

/**
 * Dispatch a notification to a single user (by id or already-loaded data),
 * honoring their preferences for the given event type.
 */
async function dispatchToUser(userRefOrData, eventType, payload) {
  const db = getFirestore("default");
  let userData = null;
  if (typeof userRefOrData === "string") {
    const snap = await db.collection("users").doc(userRefOrData).get();
    if (!snap.exists) return;
    userData = snap.data();
  } else {
    userData = userRefOrData;
  }
  if (!userData) return;

  const channels = resolveChannels(userData, eventType);
  const { title, body, data, emailSubject, emailHtml } = payload;

  if (channels.push) {
    await sendPush(collectTokens(userData), title, body, data);
  }
  if (channels.email && userData.email) {
    await sendEmail(userData.email, emailSubject || title, emailHtml || `<p>${body}</p>`);
  }
}

/**
 * Dispatch to all users in a company holding any of the given roles,
 * honoring each user's preferences.
 */
async function dispatchToRoles(companyId, roles, eventType, payload) {
  const db = getFirestore("default");
  const seen = new Set();
  for (const role of roles) {
    const snap = await db
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", role)
      .get();
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      await dispatchToUser(doc.data(), eventType, payload);
    }
  }
}

module.exports = {
  EVENT_DEFAULTS,
  resolveChannels,
  dispatchToUser,
  dispatchToRoles,
};
