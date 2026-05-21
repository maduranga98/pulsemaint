const { buildGenericReportContent } = require("./generic.template");
const { specs } = require("../reportSpecs");
exports.buildAuditTrailTemplate = (rows, options) => buildGenericReportContent(specs.audit_trail, rows, options);
