const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildMachineHealthTemplate = (rows, options) => buildGenericReportContent(specs.machine_health_score, rows, options);
