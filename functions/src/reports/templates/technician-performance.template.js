const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildTechnicianPerformanceTemplate = (rows, options) => buildGenericReportContent(specs.technician_performance, rows, options);
