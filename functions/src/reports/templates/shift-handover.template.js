const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildShiftHandoverTemplate = (rows, options) => buildGenericReportContent(specs.shift_handover_summary, rows, options);
