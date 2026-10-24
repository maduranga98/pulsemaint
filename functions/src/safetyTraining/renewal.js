const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {getFirestore} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const logger = require("firebase-functions/logger");
const {supersededInviteIds, inviteFilePaths} = require("./renewalLogic");

// Renewal clean-up of contractor safety training data. A team member whose
// Contractor Safety Card is renewed (a new training is assigned, signed off
// and a new card issued) no longer needs the earlier trainings' submissions:
// once the NEW card exists, the earlier invites for the same person and the
// same training, with their submitted marks, notes, photos and voice notes,
// are deleted. The cards themselves (`safetyCertificates`) are self-contained
// copies and are kept.

const db = getFirestore("default");
const INVITES = "safetyTrainingInvites";

exports.clearRenewedSafetyTrainingData = onDocumentUpdated(
    {database: "default", document: `${INVITES}/{inviteId}`},
    async (event) => {
      const before = event.data && event.data.before.data();
      const after = event.data && event.data.after.data();
      // Only the moment a card is first issued on this invite.
      if (!before || !after || before.cardId || !after.cardId) return;

      const snap = await db.collection(INVITES)
          .where("companyId", "==", after.companyId)
          .where("technicianId", "==", after.technicianId)
          .get();
      const others = snap.docs.map((d) => ({id: d.id, data: d.data()}));
      const ids = supersededInviteIds({id: event.params.inviteId, data: after}, others);
      if (ids.length === 0) return;

      const bucket = getStorage().bucket();
      for (const id of ids) {
        const old = others.find((o) => o.id === id).data;
        // Files named in the record, then anything left under the invite's folder.
        await Promise.all(inviteFilePaths(old).map((p) => bucket.file(p).delete({ignoreNotFound: true}).catch(() => {})));
        await bucket.deleteFiles({prefix: `safetyTrainingSubmissions/${old.companyId}/${id}/`}).catch(() => {});
        await db.collection(INVITES).doc(id).delete();
      }
      logger.info("Cleared safety training data replaced by a renewed card", {
        inviteId: event.params.inviteId, cleared: ids.length,
      });
    },
);
