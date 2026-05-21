const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildMachineHistoryTemplate = (rows, options) => buildGenericReportContent(specs.machine_history, rows, options);
