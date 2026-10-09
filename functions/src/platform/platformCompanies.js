const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const { getStripe, stripeSecretKey, firmicorePlanOfInvoice } = require("../billing/stripeClient");
const { stripeErrorMessage, isMissingResource } = require("../billing/billingAccess");
const { db, requireSuperadmin, audit, monthlyValue, toMillis } = require("./platformAccess");
const { platformSmtpPassword } = require("../lib/mailer");
const { approvalStatusOf, emailApprovalDecision, clearRegistrationAlert } = require("./companyApprovals");

const DAY = 86_400_000;
const COMPANY_ROLES = ["admin", "plant_manager", "supervisor", "technician", "store_keeper", "hr_officer", "trainee", "floor_operator", "safety_officer"];

async function adminContact(company) {
  if (!company.adminUserId) return { name: null, email: null };
  const snap = await db.doc(`companies/${company.id}/users/${company.adminUserId}`).get();
  return { name: snap.get("fullName") ?? null, email: snap.get("email") ?? null };
}

function companySummary(id, c) {
  return {
    id,
    name: c.name ?? "(unnamed)",
    country: c.country ?? null,
    industry: c.industry ?? null,
    plan: c.plan ?? "starter",
    billingCycle: c.billingCycle ?? "monthly",
    status: c.status ?? "trial",
    subscriptionStatus: c.subscriptionStatus ?? null,
    cancelAtPeriodEnd: !!c.cancelAtPeriodEnd,
    currentPeriodEnd: toMillis(c.currentPeriodEnd),
    trialEndsAt: toMillis(c.trialEndsAt),
    createdAt: toMillis(c.createdAt),
    stripeCustomerId: c.stripeCustomerId ?? null,
    hasSubscription: !!c.stripeSubscriptionId && c.subscriptionStatus !== "canceled",
    monthlyValue: monthlyValue(c),
    lastReminderAt: toMillis(c.lastPaymentReminderAt),
    platformNote: c.platformNote ?? null,
    planSetBy: c.planSetBy ?? null,
    approvalStatus: approvalStatusOf(c),
    rejectionReason: c.rejectionReason ?? null,
    approvedAt: toMillis(c.approvedAt),
  };
}

/** Headline numbers for the console's overview. */
exports.platformOverview = onCall(async (request) => {
  requireSuperadmin(request);
  const [companies, openRequests] = await Promise.all([
    db.collection("companies").get(),
    db.collection("supportRequests").where("status", "in", ["open", "in_progress"]).count().get(),
  ]);
  const now = Date.now();
  const totals = {
    companies: companies.size, active: 0, trial: 0, suspended: 0, monthly: 0, yearly: 0,
    mrr: 0, trialsEndingSoon: 0, renewalsSoon: 0, pastDue: 0, cancelling: 0,
    openRequests: openRequests.data().count,
    pendingApproval: 0,
  };
  const byPlan = {};
  companies.forEach((doc) => {
    const c = doc.data();
    if (approvalStatusOf(c) === "pending") totals.pendingApproval += 1;
    const status = c.status ?? "trial";
    totals[status] = (totals[status] ?? 0) + 1;
    if (c.stripeSubscriptionId && c.subscriptionStatus !== "canceled") {
      totals[c.billingCycle === "yearly" ? "yearly" : "monthly"] += 1;
      byPlan[c.plan] = (byPlan[c.plan] ?? 0) + 1;
    }
    totals.mrr += monthlyValue(c);
    const trialEnd = toMillis(c.trialEndsAt);
    if (status === "trial" && trialEnd && trialEnd - now < 7 * DAY) totals.trialsEndingSoon += 1;
    const periodEnd = toMillis(c.currentPeriodEnd);
    if (c.stripeSubscriptionId && periodEnd && periodEnd > now && periodEnd - now < 7 * DAY && !c.cancelAtPeriodEnd) totals.renewalsSoon += 1;
    if (["past_due", "unpaid"].includes(c.subscriptionStatus)) totals.pastDue += 1;
    if (c.cancelAtPeriodEnd) totals.cancelling += 1;
  });
  totals.mrr = Math.round(totals.mrr * 100) / 100;
  const rated = await db.collection("supportRequests").where("rating", ">=", 1).get();
  const ratings = rated.docs.map((d) => d.get("rating")).filter((r) => typeof r === "number");
  totals.ratingCount = ratings.length;
  totals.ratingAverage = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  return { totals, byPlan };
});

/** Every subscribed / registered company with its billing state. */
exports.platformListCompanies = onCall(async (request) => {
  requireSuperadmin(request);
  const snap = await db.collection("companies").get();
  const rows = await Promise.all(snap.docs.map(async (doc) => {
    const c = { id: doc.id, ...doc.data() };
    const [users, admin] = await Promise.all([
      db.collection(`companies/${doc.id}/users`).count().get(),
      adminContact(c),
    ]);
    return { ...companySummary(doc.id, c), userCount: users.data().count, adminName: admin.name, adminEmail: admin.email };
  }));
  rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { companies: rows };
});

/** One company: profile, users (with their login state), Stripe subscription and invoices. */
exports.platformGetCompany = onCall({ secrets: [stripeSecretKey] }, async (request) => {
  requireSuperadmin(request);
  const { companyId } = request.data ?? {};
  if (typeof companyId !== "string" || !companyId) throw new HttpsError("invalid-argument", "companyId is required");
  const doc = await db.collection("companies").doc(companyId).get();
  if (!doc.exists) throw new HttpsError("not-found", "Company not found");
  const c = { id: doc.id, ...doc.data() };

  const usersSnap = await db.collection(`companies/${companyId}/users`).get();
  const authUsers = new Map();
  const ids = usersSnap.docs.map((d) => ({ uid: d.id }));
  for (let i = 0; i < ids.length; i += 100) {
    const res = await getAuth().getUsers(ids.slice(i, i + 100));
    res.users.forEach((u) => authUsers.set(u.uid, u));
  }
  // A profile still marked "pending" belongs to someone who has in fact signed
  // in (registration used to leave admins "pending"; the client now flips it on
  // sign-in, but older accounts and stale clients can lag). Fix the record here
  // so the console is right regardless of what the browser did.
  const stalePending = usersSnap.docs.filter((d) => d.get("status") === "pending" && authUsers.get(d.id)?.metadata?.lastSignInTime);
  await Promise.all(stalePending.map((d) => d.ref.update({ status: "active" }).catch((err) => logger.warn(`Could not activate ${d.ref.path}`, err))));
  const activated = new Set(stalePending.map((d) => d.id));
  const users = usersSnap.docs.map((d) => {
    const p = d.data();
    const a = authUsers.get(d.id);
    return {
      uid: d.id,
      plantId: p.plantId ?? null,
      department: p.department ?? null,
      jobTitle: p.jobTitle ?? null,
      fullName: p.fullName ?? null,
      email: a?.email ?? p.email ?? null,
      phone: p.phone ?? null,
      role: p.role ?? null,
      status: activated.has(d.id) ? "active" : (p.status ?? null),
      loginMethod: p.loginMethod ?? null,
      disabled: a?.disabled ?? null,
      lastSignInAt: a?.metadata?.lastSignInTime ? Date.parse(a.metadata.lastSignInTime) : null,
      isCompanyAdmin: d.id === c.adminUserId,
    };
  });

  let stripe = { subscription: null, invoices: [], error: null };
  if (c.stripeCustomerId) {
    try {
      const s = getStripe();
      const [sub, invoices] = await Promise.all([
        c.stripeSubscriptionId ? s.subscriptions.retrieve(c.stripeSubscriptionId).catch((e) => (isMissingResource(e) ? null : Promise.reject(e))) : null,
        s.invoices.list({ customer: c.stripeCustomerId, limit: 24 }),
      ]);
      stripe = {
        subscription: sub ? {
          id: sub.id,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: (sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? 0) * 1000 || null,
          amount: sub.items?.data?.[0]?.price?.unit_amount ?? null,
          currency: sub.items?.data?.[0]?.price?.currency ?? null,
          interval: sub.items?.data?.[0]?.price?.recurring?.interval ?? null,
        } : null,
        invoices: invoices.data.filter((i) => i.status !== "draft").map((i) => {
          const plan = firmicorePlanOfInvoice(i);
          const periods = (i.lines?.data ?? []).map((l) => l.period).filter(Boolean);
          return {
            id: i.id, number: i.number, created: i.created * 1000, total: i.total, amountPaid: i.amount_paid,
            currency: i.currency, status: i.status, hostedInvoiceUrl: i.hosted_invoice_url ?? null,
            invoicePdf: i.invoice_pdf ?? null,
            plan: plan?.plan ?? null,
            billingCycle: plan?.billingCycle ?? null,
            billingReason: i.billing_reason ?? null,
            periodStart: periods.length ? Math.min(...periods.map((p) => p.start)) * 1000 : null,
            periodEnd: periods.length ? Math.max(...periods.map((p) => p.end)) * 1000 : null,
            paidAt: i.status_transitions?.paid_at ? i.status_transitions.paid_at * 1000 : null,
          };
        }),
        error: null,
      };
    } catch (err) {
      logger.error("platformGetCompany stripe lookup failed", err);
      stripe.error = stripeErrorMessage(err, "Could not load Stripe data");
    }
  }

  // Plants (sites) with their departments, for the company profile view.
  const [plantsSnap, departmentsSnap] = await Promise.all([
    db.collection("plants").where("companyId", "==", companyId).get(),
    db.collection("departments").where("companyId", "==", companyId).get(),
  ]);
  const departmentsByPlant = {};
  departmentsSnap.forEach((d) => {
    const key = d.get("plantId") ?? "";
    (departmentsByPlant[key] ??= []).push(d.get("name") ?? "");
  });
  const plants = plantsSnap.docs.map((d) => ({
    id: d.id,
    name: d.get("name") ?? "(unnamed plant)",
    code: d.get("code") ?? null,
    address: d.get("address") ?? null,
    status: d.get("status") ?? "active",
    contactPerson: d.get("contactPerson") ?? null,
    departments: (departmentsByPlant[d.id] ?? []).filter(Boolean).sort(),
    userCount: users.filter((u) => u.plantId === d.id).length,
  })).sort((a, b) => a.name.localeCompare(b.name));
  const adminProfile = users.find((u) => u.isCompanyAdmin) ?? null;

  const [admin, requests] = await Promise.all([
    adminContact(c),
    db.collection("supportRequests").where("companyId", "==", companyId).orderBy("createdAt", "desc").limit(20).get(),
  ]);
  return {
    company: { ...companySummary(companyId, c), adminName: admin.name, adminEmail: admin.email, userCount: users.length },
    profile: {
      tradeName: c.tradeName ?? null,
      description: c.description ?? null,
      address: c.address ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
      timezone: c.timezone ?? null,
      currency: c.currency ?? null,
      language: c.language ?? null,
      onboardingCompletedAt: toMillis(c.onboardingCompletedAt),
      contact: adminProfile ? {
        name: adminProfile.fullName, email: adminProfile.email, phone: adminProfile.phone, jobTitle: adminProfile.jobTitle,
      } : null,
    },
    plants,
    unassignedDepartments: (departmentsByPlant[""] ?? []).filter(Boolean).sort(),
    users,
    stripe,
    requests: requests.docs.map((d) => ({ id: d.id, subject: d.get("subject"), type: d.get("type"), status: d.get("status"), createdAt: toMillis(d.get("createdAt")) })),
  };
});

/**
 * Control a company's access and subscription:
 * approve / reject a new registration, suspend / reactivate access, extend a trial, set the plan manually
 * (e.g. an Enterprise contract billed outside Stripe), cancel or resume the
 * Stripe subscription, or keep an internal note.
 */
exports.platformUpdateCompany = onCall({ secrets: [stripeSecretKey, platformSmtpPassword] }, async (request) => {
  const actor = requireSuperadmin(request);
  const { companyId, action } = request.data ?? {};
  if (typeof companyId !== "string" || !companyId) throw new HttpsError("invalid-argument", "companyId is required");
  const ref = db.collection("companies").doc(companyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Company not found");
  const c = snap.data();
  const stamp = { updatedAt: FieldValue.serverTimestamp() };

  try {
    switch (action) {
      case "approve": {
        // The trial starts the day the company is let in, not the day it registered.
        const restartTrial = (c.status ?? "trial") === "trial" && !c.stripeSubscriptionId;
        await ref.update({
          approvalStatus: "approved",
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: actor.email ?? actor.uid,
          rejectionReason: FieldValue.delete(),
          ...(restartTrial ? { trialEndsAt: Timestamp.fromMillis(Date.now() + 14 * DAY) } : {}),
          ...stamp,
        });
        await clearRegistrationAlert(companyId);
        await emailApprovalDecision(c, (await adminContact({ id: companyId, ...c })).email, true);
        break;
      }
      case "reject": {
        const reason = String(request.data.reason ?? "").trim().slice(0, 1000);
        await ref.update({ approvalStatus: "rejected", rejectionReason: reason || FieldValue.delete(), approvedAt: FieldValue.delete(), ...stamp });
        await clearRegistrationAlert(companyId);
        await emailApprovalDecision(c, (await adminContact({ id: companyId, ...c })).email, false, reason);
        break;
      }
      case "suspend":
        await ref.update({ status: "suspended", suspendedBy: "platform", ...stamp });
        break;
      case "reactivate":
        await ref.update({
          status: (c.stripeSubscriptionId && c.subscriptionStatus !== "canceled") || c.planSetBy === "platform" ? "active" : "trial",
          suspendedBy: FieldValue.delete(),
          ...stamp,
        });
        break;
      case "extendTrial": {
        const days = Number(request.data.days);
        if (!Number.isInteger(days) || days < 1 || days > 365) throw new HttpsError("invalid-argument", "days must be 1–365");
        const base = Math.max(Date.now(), toMillis(c.trialEndsAt) ?? 0);
        await ref.update({
          trialEndsAt: Timestamp.fromMillis(base + days * 86_400_000),
          ...(c.status === "suspended" && !c.stripeSubscriptionId ? { status: "trial" } : {}),
          ...stamp,
        });
        break;
      }
      case "setPlan": {
        const { plan, billingCycle } = request.data;
        if (!["starter", "workshop", "factory", "enterprise"].includes(plan)) throw new HttpsError("invalid-argument", "Unknown plan");
        if (!["monthly", "yearly"].includes(billingCycle)) throw new HttpsError("invalid-argument", "Unknown billing cycle");
        // A plan Lumora assigns is the company's real subscription (e.g. an
        // Enterprise contract billed outside Stripe): it ends the trial, so
        // the company gets that plan's full access and limits with no trial
        // banner, trial reminders or trial expiry. A platform suspension
        // stays in place until "Restore access".
        await ref.update({
          plan,
          billingCycle,
          planSetBy: "platform",
          planSetAt: FieldValue.serverTimestamp(),
          status: c.status === "suspended" && c.suspendedBy === "platform" ? "suspended" : "active",
          trialEndsAt: null,
          ...stamp,
        });
        break;
      }
      case "cancelSubscription":
      case "resumeSubscription": {
        if (!c.stripeSubscriptionId) throw new HttpsError("failed-precondition", "No Stripe subscription");
        const cancel = action === "cancelSubscription";
        const sub = await getStripe().subscriptions.update(c.stripeSubscriptionId, { cancel_at_period_end: cancel });
        await ref.update({ cancelAtPeriodEnd: sub.cancel_at_period_end, ...stamp });
        break;
      }
      case "note": {
        const text = String(request.data.text ?? "").slice(0, 2000);
        await ref.update({ platformNote: text || FieldValue.delete(), ...stamp });
        break;
      }
      default:
        throw new HttpsError("invalid-argument", "Unknown action");
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error(`platformUpdateCompany ${action} failed`, err);
    throw new HttpsError("internal", stripeErrorMessage(err, "Update failed"));
  }
  await audit(actor, `company.${action}`, { companyId, companyName: c.name ?? null, data: request.data });
  return { ok: true };
});

/**
 * Adjust a company user's login: send or generate a password-reset link,
 * set a new password, change the role, change the sign-in email, or disable / enable the
 * account. Changes apply to Firebase Auth and the user's profile.
 */
exports.platformManageUser = onCall(async (request) => {
  const actor = requireSuperadmin(request);
  const { companyId, uid, action } = request.data ?? {};
  if (!companyId || !uid) throw new HttpsError("invalid-argument", "companyId and uid are required");
  const profileRef = db.doc(`companies/${companyId}/users/${uid}`);
  const profile = await profileRef.get();
  if (!profile.exists) throw new HttpsError("not-found", "User not found in this company");
  const auth = getAuth();
  let result = { ok: true };

  try {
    switch (action) {
      case "resetLink": {
        const user = await auth.getUser(uid);
        if (!user.email) throw new HttpsError("failed-precondition", "This user has no email address");
        result.link = await auth.generatePasswordResetLink(user.email);
        break;
      }
      case "setPassword": {
        const password = String(request.data.password ?? "");
        if (password.length < 8) throw new HttpsError("invalid-argument", "Password must be at least 8 characters");
        await auth.updateUser(uid, { password });
        await auth.revokeRefreshTokens(uid);
        break;
      }
      case "updateEmail": {
        const email = String(request.data.email ?? "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpsError("invalid-argument", "Enter a valid email");
        await auth.updateUser(uid, { email, emailVerified: false });
        await profileRef.update({ email, updatedAt: FieldValue.serverTimestamp() });
        break;
      }
      case "setRole": {
        const role = String(request.data.role ?? "");
        if (!COMPANY_ROLES.includes(role)) throw new HttpsError("invalid-argument", "Unknown role");
        const company = await db.collection("companies").doc(companyId).get();
        if (company.get("adminUserId") === uid && role !== "admin") {
          throw new HttpsError("failed-precondition", "The company owner must stay an admin");
        }
        await profileRef.update({ role, updatedAt: FieldValue.serverTimestamp() });
        // The users/{uid} mapping is what firestore.rules read the role from.
        await db.collection("users").doc(uid).set({ role }, { merge: true });
        // Sign the user out everywhere so the new role applies right away.
        await auth.revokeRefreshTokens(uid).catch(() => {});
        break;
      }
      case "disable":
      case "enable": {
        const disabled = action === "disable";
        await auth.updateUser(uid, { disabled });
        if (disabled) await auth.revokeRefreshTokens(uid);
        await profileRef.update({ status: disabled ? "inactive" : "active", updatedAt: FieldValue.serverTimestamp() });
        break;
      }
      default:
        throw new HttpsError("invalid-argument", "Unknown action");
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error(`platformManageUser ${action} failed`, err);
    throw new HttpsError("internal", err?.message || "Could not update the user");
  }
  // Never log the password itself.
  await audit(actor, `user.${action}`, {
    companyId,
    targetUid: uid,
    ...(action === "updateEmail" ? { email: request.data.email } : {}),
    ...(action === "setRole" ? { role: request.data.role, previousRole: profile.get("role") ?? null } : {}),
  });
  return result;
});

exports.platformAuditLog = onCall(async (request) => {
  requireSuperadmin(request);
  const { companyId } = request.data ?? {};
  let q = db.collection("platformAuditLog").orderBy("createdAt", "desc").limit(100);
  if (companyId) q = db.collection("platformAuditLog").where("companyId", "==", companyId).orderBy("createdAt", "desc").limit(50);
  const snap = await q.get();
  return {
    entries: snap.docs.map((d) => ({
      id: d.id, action: d.get("action"), actorEmail: d.get("actorEmail") ?? null,
      companyName: d.get("companyName") ?? null, companyId: d.get("companyId") ?? null,
      createdAt: toMillis(d.get("createdAt")),
    })),
  };
});
