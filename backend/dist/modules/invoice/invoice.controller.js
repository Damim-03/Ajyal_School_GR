"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelInvoiceController = exports.updateInvoiceController = exports.generateInvoicesController = exports.createInvoiceController = exports.getInvoiceController = exports.listInvoicesController = void 0;
const api_response_1 = require("../../core/config/api-response");
const invoice_service_1 = require("./invoice.service");
const listInvoicesController = async (req, res) => {
    const query = req.query;
    const { invoices, pagination } = await (0, invoice_service_1.listInvoicesService)(query);
    return api_response_1.ApiResponse.paginated(res, invoices, pagination, "Invoices retrieved");
};
exports.listInvoicesController = listInvoicesController;
const getInvoiceController = async (req, res) => {
    const invoice = await (0, invoice_service_1.getInvoiceService)(req.params.id);
    return api_response_1.ApiResponse.success(res, { invoice }, "Invoice retrieved");
};
exports.getInvoiceController = getInvoiceController;
const createInvoiceController = async (req, res) => {
    const invoice = await (0, invoice_service_1.createInvoiceService)(req.body, req.user?.userId);
    return api_response_1.ApiResponse.created(res, { invoice }, "Invoice created");
};
exports.createInvoiceController = createInvoiceController;
// POST /api/invoices/generate — فواتير الشهر دفعة واحدة
const generateInvoicesController = async (req, res) => {
    const result = await (0, invoice_service_1.generateInvoicesService)(req.body, req.user?.userId);
    return api_response_1.ApiResponse.created(res, result, `${result.created} invoice(s) generated`);
};
exports.generateInvoicesController = generateInvoicesController;
const updateInvoiceController = async (req, res) => {
    const invoice = await (0, invoice_service_1.updateInvoiceService)(req.params.id, req.body);
    return api_response_1.ApiResponse.success(res, { invoice }, "Invoice updated");
};
exports.updateInvoiceController = updateInvoiceController;
// POST /api/invoices/:id/cancel
const cancelInvoiceController = async (req, res) => {
    const invoice = await (0, invoice_service_1.cancelInvoiceService)(req.params.id, req.body, req.user.userId);
    return api_response_1.ApiResponse.success(res, { invoice }, "Invoice cancelled");
};
exports.cancelInvoiceController = cancelInvoiceController;
//# sourceMappingURL=invoice.controller.js.map