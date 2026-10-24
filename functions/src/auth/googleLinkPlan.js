/**
 * Decides what to do when someone signs in with Google and that Google account
 * has no FirmiCore company yet. Pure (no I/O) so it can be tested on its own —
 * linkGoogleLogin.js gathers the facts and acts on the answer.
 *
 * Google sign-in is only for people who already registered (a company
 * registration, or an accepted invitation, with email + password). Their
 * registered Firebase login is the one that owns the company data, so a Google
 * account that was created on the side must be folded into it — never given a
 * company of its own, and never allowed in when the email was never registered.
 *
 * @param {object} f the facts
 * @param {boolean} f.googleHasCompany the Google login already maps to a company
 * @param {boolean} f.googleEmailVerified Google vouches for the email
 * @param {string[]} f.googleProviders provider ids on the Google login
 * @param {number} f.googleCreatedMs when the Google login was created
 * @param {number} f.nowMs now
 * @param {?object} f.registered the registered login with the same email, or null:
 *   {uid, sameAsGoogle, hasGoogleLinked, isSuperadmin, companyId, inactive}
 * @return {{action: string, reason?: string, deleteGoogleLogin?: boolean}}
 *   action: "ready" (nothing to do), "link", or "reject"
 */
function planGoogleLink(f) {
  if (f.googleHasCompany) return {action: "ready"};

  // Only an account made by this very attempt may be deleted: Google as its
  // only provider, created minutes ago.
  const FRESH_MS = 10 * 60 * 1000;
  const fresh = Array.isArray(f.googleProviders) &&
    f.googleProviders.length === 1 && f.googleProviders[0] === "google.com" &&
    f.nowMs - f.googleCreatedMs <= FRESH_MS;

  if (!f.googleEmailVerified) return {action: "reject", reason: "unverified-email", deleteGoogleLogin: fresh};

  const r = f.registered;
  if (!r || r.sameAsGoogle || !r.companyId) {
    return {action: "reject", reason: "not-registered", deleteGoogleLogin: fresh};
  }
  if (r.isSuperadmin) return {action: "reject", reason: "platform-account", deleteGoogleLogin: false};
  if (r.inactive) return {action: "reject", reason: "inactive", deleteGoogleLogin: false};
  if (r.hasGoogleLinked) return {action: "reject", reason: "already-linked", deleteGoogleLogin: false};
  if (!fresh) return {action: "reject", reason: "not-fresh", deleteGoogleLogin: false};
  return {action: "link"};
}

module.exports = {planGoogleLink};
