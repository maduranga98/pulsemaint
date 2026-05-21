const { buildGenericReportContent } = require("./generic.template");
const { specs } = require("../reportSpecs");
exports.buildInventoryUsageTemplate = (rows, options) => buildGenericReportContent(specs.inventory_usage, rows, options);
