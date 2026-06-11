/**
 * onCommentMention
 *
 * Fires when a comment is created under a Work Order or a machine profile.
 * For each @mentioned user it dispatches push/email per that user's
 * notification preferences (event type "mention"). The in-app inbox document
 * is written client-side, so this function only handles push/email channels.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { dispatchToUser } = require("../lib/notificationDispatch");

async function handleComment(parentType, parentId, comment) {
  if (!comment || comment.deleted) return;
  const mentions = Array.isArray(comment.mentions) ? comment.mentions : [];
  if (mentions.length === 0) return;

  const authorName = comment.authorName || "Someone";
  const text = String(comment.text || "").slice(0, 140);
  const link =
    parentType === "workOrders"
      ? `/app/work-orders?woId=${parentId}`
      : `/app/machines/${parentId}`;

  await Promise.all(
    mentions
      .filter((m) => m && m.userId && m.userId !== comment.authorId)
      .map((m) =>
        dispatchToUser(m.userId, "mention", {
          title: `${authorName} mentioned you`,
          body: text,
          data: { type: "mention", parentType, parentId, link },
          emailSubject: `${authorName} mentioned you in PulseMaint`,
          emailHtml: `<p>${authorName} mentioned you:</p><blockquote>${text}</blockquote>`,
        }),
      ),
  );

  logger.info(`Dispatched ${mentions.length} mention notifications for ${parentType}/${parentId}`);
}

exports.onWorkOrderCommentMention = onDocumentCreated(
  { database: "default", document: "workOrders/{woId}/comments/{commentId}" },
  async (event) => {
    const data = event.data && event.data.data();
    await handleComment("workOrders", event.params.woId, data);
  },
);

exports.onMachineCommentMention = onDocumentCreated(
  { database: "default", document: "machines/{machineId}/comments/{commentId}" },
  async (event) => {
    const data = event.data && event.data.data();
    await handleComment("machines", event.params.machineId, data);
  },
);
