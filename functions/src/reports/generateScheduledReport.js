const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

exports.generateScheduledReport = onSchedule("every day 04:00", async () => {
  logger.info("Scheduled reports coming in Phase 3");
});
