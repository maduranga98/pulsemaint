const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildLowStockTemplate = (rows, options) => buildGenericReportContent(specs.low_stock_alert, rows, options);
