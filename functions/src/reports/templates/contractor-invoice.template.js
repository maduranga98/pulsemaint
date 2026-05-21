const {buildGenericReportContent} = require("./generic.template");
const {specs} = require("../reportSpecs");
exports.buildContractorInvoiceTemplate = (rows, options) => buildGenericReportContent(specs.contractor_invoice_comparison, rows, options);
