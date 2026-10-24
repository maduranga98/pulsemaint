// Pure helpers of the renewal clean-up (no Firebase imports, so they can be unit-tested).

/**
 * @param {object} ts a Firestore Timestamp, {seconds}, or number
 * @return {number} milliseconds, 0 when missing
 */
function millis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

/**
 * Which of `others` the renewed invite supersedes: same company, contractor,
 * team member and training, assigned strictly earlier.
 * @param {{id: string, data: object}} renewed the invite that just got its card
 * @param {{id: string, data: object}[]} others every other invite of that person
 * @return {string[]} ids to delete
 */
function supersededInviteIds(renewed, others) {
  const cur = renewed.data;
  const since = millis(cur.assignedAt);
  return others
      .filter(({id, data}) => id !== renewed.id &&
        data.companyId === cur.companyId &&
        data.contractorId === cur.contractorId &&
        data.technicianId === cur.technicianId &&
        data.moduleId === cur.moduleId &&
        millis(data.assignedAt) < since)
      .map(({id}) => id);
}

/**
 * Storage paths a safety training invite uploaded (every attempt's files).
 * @param {object} invite invite data
 * @return {string[]} paths
 */
function inviteFilePaths(invite) {
  return (invite.attempts || []).flatMap((a) => (a.attachments || []).map((f) => f.path)).filter(Boolean);
}

module.exports = {supersededInviteIds, inviteFilePaths};
