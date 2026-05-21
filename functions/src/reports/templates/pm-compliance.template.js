const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildPmComplianceTemplate = (rows, options) => buildGenericReportContent(specs.pm_compliance, rows, options);
