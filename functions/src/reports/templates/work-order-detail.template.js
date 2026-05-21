const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildWorkOrderDetailTemplate = (rows, options) => buildGenericReportContent(specs.work_order_detail, rows, options);
