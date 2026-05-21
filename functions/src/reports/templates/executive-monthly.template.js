const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildExecutiveMonthlyTemplate = (rows, options) => buildGenericReportContent(specs.executive_monthly, rows, options);
