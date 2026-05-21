const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildMaintenanceCostTemplate = (rows, options) => buildGenericReportContent(specs.maintenance_cost, rows, options);
