const { buildGenericReportContent } = require("./generic.template");
const { specs } = require("../reportSpecs");
exports.buildDowntimeAnalysisTemplate = (rows, options) => buildGenericReportContent(specs.downtime_analysis, rows, options);
