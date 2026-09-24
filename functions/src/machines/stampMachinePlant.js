const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

const db = getFirestore("default");

// Work orders and breakdowns are plant-scoped by their denormalized
// `machinePlantId`. Any record created without one (an older client, a
// server-generated PM work order, an import) is stamped here from its
// machine's current plant, so plant-scoped roles can see it.
async function stamp(snap, label) {
  const data = snap && snap.data();
  if (!data || data.machinePlantId || !data.machineId) return;
  try {
    const machine = await db.collection("machines").doc(String(data.machineId)).get();
    const plantId = machine.exists ? machine.data().plantId || null : null;
    if (!plantId) return;
    await snap.ref.update({machinePlantId: plantId});
  } catch (err) {
    logger.error(`stampMachinePlant (${label}) failed`, {id: snap.id, err});
  }
}

exports.stampWorkOrderPlant = onDocumentCreated(
    {database: "default", document: "workOrders/{woId}"},
    (event) => stamp(event.data, "workOrders"),
);

exports.stampBreakdownPlant = onDocumentCreated(
    {database: "default", document: "breakdown_tickets/{ticketId}"},
    (event) => stamp(event.data, "breakdown_tickets"),
);
