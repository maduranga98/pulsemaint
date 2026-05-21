const { buildGenericReportContent } = require("./generic.template");
const { specs } = require("../reportSpecs");
exports.buildSafetyNearMissTemplate = (rows, options) => buildGenericReportContent(specs.safety_near_miss, rows, options);
