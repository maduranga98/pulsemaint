const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildBreakdownSummaryTemplate = (rows, options) => buildGenericReportContent(specs.breakdown_summary, rows, options);
