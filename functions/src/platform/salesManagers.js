const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue } = require("firebase-admin/firestore");
const { db, requireSuperadmin, audit, toMillis } = require("./platformAccess");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function checkPassword(p) {
  if (typeof p !== "string" || p.length < 8 || p.length > 128) {
    throw new HttpsError("invalid-argument", "Password must be 8–128 characters");
  }
}

/** The sales manager's own record; refuses any uid that is not one (so this never touches tenant users or superadmins). */
async function salesManagerRef(uid) {
  if (typeof uid !== "string" || !uid) throw new HttpsError("invalid-argument", "uid is required");
  const ref = db.collection("platformSalesManagers").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Sales manager not found");
  return ref;
}

/**
 * Sales managers: Lumora staff who sign in at /platform/login and only see the
 * sales part of the console (leads, calls, feature requests, to-do, trial
 * requests). The login is a Firebase Auth user with the custom claim
 * `salesManager: true` and no company. Only a superadmin manages them.
 */
exports.platformListSalesManagers = onCall(async (request) => {
  requireSuperadmin(request);
  const snap = await db.collection("platformSalesManagers").get();
  const rows = await Promise.all(snap.docs.map(async (d) => {
    let disabled = false;
    let lastSignInAt = null;
    try {
      const u = await getAuth().getUser(d.id);
      disabled = u.disabled;
      lastSignInAt = u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : null;
    } catch {
      disabled = true;
    }
    return { uid: d.id, name: d.get("name") ?? null, email: d.get("email") ?? null, createdAt: toMillis(d.get("createdAt")), disabled, lastSignInAt };
  }));
  rows.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  return { managers: rows };
});

exports.platformCreateSalesManager = onCall(async (request) => {
  const actor = requireSuperadmin(request);
  const name = text(request.data?.name, 120);
  const email = text(request.data?.email, 200).toLowerCase();
  const password = request.data?.password;
  if (!name) throw new HttpsError("invalid-argument", "Name is required");
  if (!EMAIL_RE.test(email)) throw new HttpsError("invalid-argument", "Enter a valid email address");
  checkPassword(password);

  let user;
  try {
    user = await getAuth().createUser({ email, password, displayName: name, emailVerified: true });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "An account with this email already exists. Use a different email.");
    }
    throw new HttpsError("invalid-argument", err.message || "Could not create the login");
  }
  await getAuth().setCustomUserClaims(user.uid, { salesManager: true });
  await db.collection("platformSalesManagers").doc(user.uid).set({
    uid: user.uid, name, email, createdAt: FieldValue.serverTimestamp(), createdBy: actor.email ?? actor.uid,
  });
  await audit(actor, "salesManager.create", { targetUid: user.uid, email });
  return { ok: true, uid: user.uid };
});

exports.platformManageSalesManager = onCall(async (request) => {
  const actor = requireSuperadmin(request);
  const { uid, action } = request.data ?? {};
  const ref = await salesManagerRef(uid);
  const email = (await ref.get()).get("email") ?? null;

  switch (action) {
    case "setPassword":
      checkPassword(request.data.password);
      await getAuth().updateUser(uid, { password: request.data.password });
      await getAuth().revokeRefreshTokens(uid);
      break;
    case "disable":
      await getAuth().updateUser(uid, { disabled: true });
      await getAuth().revokeRefreshTokens(uid);
      break;
    case "enable":
      await getAuth().updateUser(uid, { disabled: false });
      break;
    case "remove":
      try {
        await getAuth().deleteUser(uid);
      } catch (err) {
        if (err.code !== "auth/user-not-found") throw err;
      }
      await ref.delete();
      break;
    default:
      throw new HttpsError("invalid-argument", "Unknown action");
  }
  await audit(actor, `salesManager.${action}`, { targetUid: uid, email });
  return { ok: true };
});
