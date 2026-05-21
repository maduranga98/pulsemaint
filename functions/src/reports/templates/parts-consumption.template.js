const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildPartsConsumptionTemplate = (rows, options) => buildGenericReportContent(specs.parts_consumption, rows, options);
