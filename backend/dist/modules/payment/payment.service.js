"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelPaymentService = exports.createPaymentService = exports.getPaymentService = exports.listPaymentsService = void 0;
const prisma_1 = require("../../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const time_1 = require("../../core/utils/time");
const teacher_debt_share_service_1 = require("../teacher-debt-share/teacher-debt-share.service");
const document_number_1 = require("../../core/utils/document-number");
const text_match_1 = require("../../core/search/text-match");
const paymentSelect = {
    id: true,
    paymentNumber: true,
    amount: true,
    paymentMethod: true,
    status: true,
    paymentDate: true,
    note: true,
    receivedById: true,
    cancelledAt: true,
    cancelledById: true,
    cancelReason: true,
    createdAt: true,
    updatedAt: true,
    receivedBy: { select: { id: true, username: true } },
    cancelledBy: { select: { id: true, username: true } },
    receipt: {
        select: {
            id: true,
            receiptNumber: true,
            status: true,
            printed: true,
            printedAt: true,
        },
    },
    paymentInvoices: {
        select: {
            id: true,
            paidAmount: true,
            invoice: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    month: true,
                    year: true,
                    total: true,
                    remaining: true,
                    status: true,
                    studentEnrollment: {
                        select: {
                            id: true,
                            student: { select: { id: true, firstName: true, lastName: true } },
                            teachingAssignment: {
                                select: { subject: { select: { id: true, name: true } } },
                            },
                        },
                    },
                },
            },
        },
    },
};
const toResponse = (payment) => ({
    ...payment,
    amount: Number(payment.amount),
    paymentInvoices: payment.paymentInvoices.map((pi) => ({
        ...pi,
        paidAmount: Number(pi.paidAmount),
        invoice: {
            ...pi.invoice,
            total: Number(pi.invoice.total),
            remaining: Number(pi.invoice.remaining),
        },
    })),
});
// --------------------------------------------------
// ترقيم الدفعات والإيصالات — ثلاث عشرة خانة عشوائية
//
// كان `PAY-2026-10-0001`. والقاعدة والتفصيل في
// `core/utils/document-number`: الرقم يُمسح باركوداً، ولا يُفشي عدد
// دفعات الشهر، ولا يُخمَّن.
//
// والفحص داخل المعاملة نفسها التي ستحفظ الصفّ — لا قبلها: بين فحصٍ
// خارجها وحفظٍ فيها تسع فرجةٌ لدفعةٍ أخرى تأخذ الرقم.
// --------------------------------------------------
const uniqueNumber = async (tx, kind) => {
    const number = await (0, document_number_1.uniqueDocumentNumber)(async (candidate) => kind === "PAY"
        ? (await tx.payment.count({ where: { paymentNumber: candidate } })) > 0
        : (await tx.receipt.count({ where: { receiptNumber: candidate } })) > 0);
    if (!number) {
        throw new app_errors_1.ConflictException("تعذّر توليد رقمٍ فريد للمستند — أعد المحاولة", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    return number;
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const payment = await client_1.prisma.payment.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!payment) {
        throw new app_errors_1.NotFoundException("Payment not found", error_code_enum_1.ErrorCodeEnum.PAYMENT_NOT_FOUND);
    }
    return payment;
};
const deriveInvoiceStatus = (remaining, paid) => remaining.lte(0) ? "PAID" : paid.gt(0) ? "PARTIAL" : "PENDING";
// --------------------------------------------------
// List
// --------------------------------------------------
const listPaymentsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    /*
     * مرشِّحاتُ الطالب — تُبنى طبقةً طبقةً لا تُكتب متداخلةً في مكانها.
     *
     * الطريقُ من الدفعة إلى الطالب واحد: سطرُ توزيعٍ ← فاتورة ← تسجيل ←
     * طالب. فلو كُتب كلُّ مرشِّحٍ في موضعه لتكرّر مفتاحُ `invoice` مرّتين
     * حين يجتمع رقمُ التسجيل والاسم — والثاني يمحو الأوّل صامتاً.
     */
    /*
     * المطابقةُ النصّية بترتيبٍ صريح — انظر `core/search/text-match`.
     * والاسمُ يُقسَّم كلماتٍ لأنّه في حقلين.
     */
    const numberIds = query.studentNumber
        ? await (0, text_match_1.matchTextIds)("Student", [
            (0, text_match_1.containsOn)(["studentNumber"], query.studentNumber),
        ])
        : null;
    const nameIds = query.studentName
        ? await (0, text_match_1.matchTextIds)("Student", (0, text_match_1.words)(query.studentName).length > 1
            ? (0, text_match_1.words)(query.studentName).map((token) => (0, text_match_1.containsOn)(["firstName", "lastName"], token))
            : [(0, text_match_1.containsOn)(["firstName", "lastName"], query.studentName)])
        : null;
    /* مرشِّحان مستقلّان على المعرّف — يُجمعان بـAND لا يتزاحمان */
    const studentById = [];
    if (numberIds)
        studentById.push({ id: { in: numberIds } });
    if (nameIds)
        studentById.push({ id: { in: nameIds } });
    const studentFilter = studentById.length > 0 ? { AND: studentById } : {};
    const enrollmentFilter = {
        ...(query.studentId && { studentId: query.studentId }),
        ...(Object.keys(studentFilter).length > 0 && { student: studentFilter }),
    };
    const lineFilter = {
        ...(query.invoiceId && { invoiceId: query.invoiceId }),
        ...(Object.keys(enrollmentFilter).length > 0 && {
            invoice: { studentEnrollment: enrollmentFilter },
        }),
    };
    const paymentIds = query.search
        ? await (0, text_match_1.matchTextIds)("Payment", [
            (0, text_match_1.containsOn)(["paymentNumber"], query.search),
        ])
        : null;
    const receiptIds = query.search
        ? await (0, text_match_1.matchTextIds)("Receipt", [
            (0, text_match_1.containsOn)(["receiptNumber"], query.search),
        ])
        : null;
    const where = {
        ...(query.status && { status: query.status }),
        ...(query.paymentMethod && { paymentMethod: query.paymentMethod }),
        ...(query.receivedById && { receivedById: query.receivedById }),
        /**
         * البحثُ يشمل رقم الإيصال كما يشمل رقم الدفعة.
         *
         * كان على `paymentNumber` وحده، وحقلُ البحث يَعِد بـ«رقم الدفعة أو
         * الإيصال» — وعدٌ لا يُوفى. والورقةُ التي في يد الموظّف تحمل رقم
         * **الإيصال** بارزاً وباركودُها يشفّره (`ReceiptDoc`)، فمن نسخ ما
         * قرأ ارتدّ بلا نتيجة والورقةُ أمامه.
         */
        ...(query.search && {
            OR: [
                { id: { in: paymentIds ?? [] } },
                { receipt: { id: { in: receiptIds ?? [] } } },
            ],
        }),
        ...((query.dateFrom || query.dateTo) && {
            paymentDate: {
                ...(query.dateFrom && { gte: (0, time_1.startOfUtcDay)(query.dateFrom) }),
                ...(query.dateTo && { lt: (0, time_1.addUtcDays)((0, time_1.startOfUtcDay)(query.dateTo), 1) }),
            },
        }),
        /*
         * `some` لا `every`: الدفعةُ الواحدة كلُّ فواتيرها لطالبٍ واحد،
         * فمطابقةُ سطرٍ منها مطابقةٌ لها.
         */
        ...(Object.keys(lineFilter).length > 0 && {
            paymentInvoices: { some: lineFilter },
        }),
    };
    const [payments, total] = await Promise.all([
        client_1.prisma.payment.findMany({
            where,
            select: paymentSelect,
            skip,
            take,
            orderBy: { paymentDate: "desc" },
        }),
        client_1.prisma.payment.count({ where }),
    ]);
    return {
        payments: payments.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listPaymentsService = listPaymentsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getPaymentService = async (id) => {
    await findOrThrow(id);
    const payment = await client_1.prisma.payment.findUnique({
        where: { id },
        select: paymentSelect,
    });
    return payment ? toResponse(payment) : null;
};
exports.getPaymentService = getPaymentService;
// --------------------------------------------------
// Create
//
// كل شيء داخل transaction واحدة:
//   1. قراءة الفواتير بحالتها اللحظية
//   2. رفض ما يتجاوز المتبقّي
//   3. إنشاء الدفعة وتوزيعاتها
//   4. تحديث remaining و status لكل فاتورة
//   5. إنشاء الإيصال
//
// remaining يُحدَّث ذرّياً مع PaymentInvoice كما تنصّ
// قاعدة schema.prisma.
// --------------------------------------------------
const createPaymentService = async (body, receivedById) => {
    const invoiceIds = body.allocations.map((a) => a.invoiceId);
    const paymentDate = body.paymentDate
        ? (0, time_1.startOfUtcDay)(body.paymentDate)
        : (0, time_1.startOfUtcDay)(new Date());
    const paymentId = await client_1.prisma.$transaction(async (tx) => {
        const invoices = await tx.invoice.findMany({
            where: { id: { in: invoiceIds } },
            select: {
                id: true,
                invoiceNumber: true,
                status: true,
                total: true,
                remaining: true,
            },
        });
        if (invoices.length !== invoiceIds.length) {
            const found = new Set(invoices.map((i) => i.id));
            const missing = invoiceIds.filter((id) => !found.has(id));
            throw new app_errors_1.NotFoundException(`Invoice(s) not found: ${missing.join(", ")}`, error_code_enum_1.ErrorCodeEnum.INVOICE_NOT_FOUND);
        }
        const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
        const cancelled = invoices.filter((i) => i.status === "CANCELLED");
        if (cancelled.length > 0) {
            throw new app_errors_1.BadRequestException(`Cannot pay cancelled invoice(s): ` +
                cancelled.map((i) => i.invoiceNumber).join(", "), error_code_enum_1.ErrorCodeEnum.INVOICE_CANCELLED);
        }
        // لا يُسمح بتجاوز المتبقّي — وإلا صار remaining سالباً
        const overpaid = body.allocations
            .map((allocation) => ({
            allocation,
            invoice: byId.get(allocation.invoiceId),
        }))
            .filter(({ allocation, invoice }) => new prisma_1.Prisma.Decimal(allocation.paidAmount).gt(invoice.remaining));
        if (overpaid.length > 0) {
            throw new app_errors_1.BadRequestException(`Amount exceeds what is due: ` +
                overpaid
                    .map(({ allocation, invoice }) => `${invoice.invoiceNumber} (paying ${allocation.paidAmount}, due ${invoice.remaining})`)
                    .join(", "), error_code_enum_1.ErrorCodeEnum.PAYMENT_AMOUNT_INVALID);
        }
        // المبلغ الإجمالي مشتقّ من التوزيعات
        const amount = body.allocations.reduce((sum, allocation) => sum.plus(new prisma_1.Prisma.Decimal(allocation.paidAmount)), new prisma_1.Prisma.Decimal(0));
        const payment = await tx.payment.create({
            data: {
                paymentNumber: await uniqueNumber(tx, "PAY"),
                amount,
                paymentMethod: body.paymentMethod ?? "CASH",
                paymentDate,
                note: body.note ?? null,
                receivedById,
            },
            select: { id: true },
        });
        for (const allocation of body.allocations) {
            const invoice = byId.get(allocation.invoiceId);
            const paidAmount = new prisma_1.Prisma.Decimal(allocation.paidAmount);
            await tx.paymentInvoice.create({
                data: { paymentId: payment.id, invoiceId: invoice.id, paidAmount },
            });
            const remaining = invoice.remaining.minus(paidAmount);
            const paidSoFar = invoice.total.minus(remaining);
            await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    remaining,
                    status: deriveInvoiceStatus(remaining, paidSoFar),
                },
            });
        }
        /*
         * حصةُ الأستاذ من دَينٍ حُصّل بعد تخليصه.
         *
         * تقع هنا لا في وظيفةٍ لاحقة: المال المقبوض والحصة المستحقّة عليه
         * واقعةٌ واحدة — ولو انفصلتا لبقي دَينٌ حُصّل بلا حصةٍ لصاحبها لا
         * يعرف بها أحد. وهي لا ترمي: قبضُ مال الطالب لا يُعطَّل لأنّ
         * نسبة الأستاذ غامضة.
         */
        await (0, teacher_debt_share_service_1.recordDebtCollections)(tx, payment.id, body.allocations.map((allocation) => ({
            invoiceId: allocation.invoiceId,
            paidAmount: new prisma_1.Prisma.Decimal(allocation.paidAmount),
        })), paymentDate);
        // إيصال لكل دفعة — Receipt.paymentId فريد وإلزامي
        await tx.receipt.create({
            data: {
                receiptNumber: await uniqueNumber(tx, "REC"),
                paymentId: payment.id,
            },
        });
        return payment.id;
    });
    const payment = await client_1.prisma.payment.findUnique({
        where: { id: paymentId },
        select: paymentSelect,
    });
    return toResponse(payment);
};
exports.createPaymentService = createPaymentService;
// --------------------------------------------------
// Cancel
//
// عكسٌ كامل بلا حذف أي صف:
//   1. الدفعة → CANCELLED
//   2. كل فاتورة متأثّرة يُعاد حساب remaining و status
//      من مجموع الدفعات النشطة وحدها
//   3. الإيصال المرتبط → CANCELLED
//
// صفوف PaymentInvoice تبقى كما هي للتدقيق.
// --------------------------------------------------
const cancelPaymentService = async (id, body, cancelledById) => {
    const cancelledAt = new Date();
    await client_1.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                paymentInvoices: { select: { invoiceId: true } },
                receipt: { select: { id: true, status: true } },
            },
        });
        if (!payment) {
            throw new app_errors_1.NotFoundException("Payment not found", error_code_enum_1.ErrorCodeEnum.PAYMENT_NOT_FOUND);
        }
        if (payment.status === "CANCELLED") {
            throw new app_errors_1.ConflictException("Payment is already cancelled", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
        }
        await tx.payment.update({
            where: { id },
            data: {
                status: "CANCELLED",
                cancelledAt,
                cancelledById,
                cancelReason: body.reason ?? null,
            },
        });
        // إعادة حساب كل فاتورة متأثّرة بعد استبعاد هذه الدفعة
        const invoiceIds = [
            ...new Set(payment.paymentInvoices.map((pi) => pi.invoiceId)),
        ];
        for (const invoiceId of invoiceIds) {
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                select: { id: true, total: true, status: true },
            });
            // الفاتورة الملغاة تبقى كما هي
            if (!invoice || invoice.status === "CANCELLED")
                continue;
            const stillPaid = await tx.paymentInvoice.aggregate({
                where: { invoiceId, payment: { status: "ACTIVE" } },
                _sum: { paidAmount: true },
            });
            const paid = stillPaid._sum.paidAmount ?? new prisma_1.Prisma.Decimal(0);
            const remaining = invoice.total.minus(paid);
            await tx.invoice.update({
                where: { id: invoiceId },
                data: { remaining, status: deriveInvoiceStatus(remaining, paid) },
            });
        }
        // الوصل يتبع دفعته: إلغاء الاستلام يُبطل إثباته
        if (payment.receipt && payment.receipt.status !== "CANCELLED") {
            await tx.receipt.update({
                where: { id: payment.receipt.id },
                data: {
                    status: "CANCELLED",
                    cancelledAt,
                    cancelledById,
                    cancelReason: body.reason ?? "Payment cancelled",
                },
            });
        }
    });
    const payment = await client_1.prisma.payment.findUnique({
        where: { id },
        select: paymentSelect,
    });
    return toResponse(payment);
};
exports.cancelPaymentService = cancelPaymentService;
//# sourceMappingURL=payment.service.js.map