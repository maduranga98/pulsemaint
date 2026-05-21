const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildContractorPerformanceTemplate = (rows, options) => buildGenericReportContent(specs.contractor_performance, rows, options);
