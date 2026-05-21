const { buildGenericReportContent } = require("./generic.template");
const { specs } = require("../reportSpecs");
exports.buildTrainingComplianceTemplate = (rows, options) => buildGenericReportContent(specs.training_compliance, rows, options);
