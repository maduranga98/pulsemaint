const { buildGenericReportContent } = require("./generic.template");
const { specs } = require("../reportSpecs");
exports.buildSlaComplianceTemplate = (rows, options) => buildGenericReportContent(specs.sla_compliance, rows, options);
