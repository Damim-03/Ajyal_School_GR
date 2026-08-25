"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oldDebtRows = exports.revenueBySubject = exports.fetchDebtCollectionRows = exports.debtAging = exports.fetchDebtRows = exports.receiptCounts = exports.fetchReceiptRows = exports.fetchPaymentRows = exports.fetchInvoiceRows = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
const reports_scope_1 = require("./reports.scope");
const reports_table_1 = require("./reports.table");
const fetchInvoiceRows = async (query, request, sort) => {
    /*
     * `includeCancelled` هنا لأنّ شاشة الفواتير تعرض الحالات كلَّها.
     *
     * وليس هذا خرقاً لـ§52: القاعدةُ أنّ الملغى لا يدخل **المجاميع
     * المالية** — والمجاميعُ تُحسب في `assemble` من استعلامٍ آخر
     * يستثنيه. أمّا الجدولُ فسجلٌّ يُقرأ، وإخفاءُ الملغى منه يمنع
     * الإدارةَ من مراجعة ما أُلغي.
     */
    const where = (0, reports_scope_1.invoiceScope)(query, { includeCancelled: true });
    const [total, invoices] = await client_1.prisma.$transaction([
        client_1.prisma.invoice.count({ where }),
        client_1.prisma.invoice.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                invoiceNumber: true,
                month: true,
                year: true,
                amount: true,
                discount: true,
                total: true,
                remaining: true,
                status: true,
                dueDate: true,
                studentEnrollment: {
                    select: {
                        student: { select: { firstName: true, lastName: true } },
                        teachingAssignment: {
                            select: {
                                subject: { select: { name: true } },
                                studyGroup: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        }),
    ]);
    const rows = invoices.map((invoice) => {
        const enrollment = invoice.studentEnrollment;
        const totalValue = (0, reporting_1.toNumber)(invoice.total);
        const remaining = (0, reporting_1.toNumber)(invoice.remaining);
        return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
            subject: enrollment.teachingAssignment.subject.name,
            studyGroup: enrollment.teachingAssignment.studyGroup.name,
            month: invoice.month,
            year: invoice.year,
            amount: (0, reporting_1.toNumber)(invoice.amount),
            discount: (0, reporting_1.toNumber)(invoice.discount),
            total: totalValue,
            /* المسدَّد مشتقٌّ لا مخزَّن — الفاتورة تحمل الإجمالي والمتبقّي */
            paid: totalValue - remaining,
            remaining,
            status: invoice.status,
            dueDate: invoice.dueDate.toISOString(),
        };
    });
    return { rows, total };
};
exports.fetchInvoiceRows = fetchInvoiceRows;
const fetchPaymentRows = async (query, request, sort) => {
    const where = (0, reports_scope_1.paymentScope)(query, { includeCancelled: true });
    const [total, payments] = await client_1.prisma.$transaction([
        client_1.prisma.payment.count({ where }),
        client_1.prisma.payment.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                paymentNumber: true,
                amount: true,
                paymentMethod: true,
                paymentDate: true,
                status: true,
                receivedBy: { select: { firstName: true, lastName: true } },
                receipt: { select: { receiptNumber: true, status: true } },
                paymentInvoices: {
                    select: {
                        invoice: {
                            select: {
                                studentEnrollment: {
                                    select: {
                                        student: { select: { firstName: true, lastName: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }),
    ]);
    const rows = payments.map((payment) => {
        /*
         * الدفعةُ قد تسدّد فواتيرَ عدّة موادّ لطالبٍ واحد، وقد تسدّد
         * لأكثرَ من طالب. فالأسماءُ تُجمَّع بلا تكرار — وعرضُ الاسم
         * مكرّراً ثلاثاً يوحي بثلاثة أشخاص.
         */
        const names = new Set(payment.paymentInvoices.map((link) => `${link.invoice.studentEnrollment.student.firstName} ${link.invoice.studentEnrollment.student.lastName}`.trim()));
        return {
            id: payment.id,
            paymentNumber: payment.paymentNumber,
            amount: (0, reporting_1.toNumber)(payment.amount),
            paymentMethod: payment.paymentMethod,
            paymentDate: payment.paymentDate.toISOString(),
            status: payment.status,
            receivedBy: payment.receivedBy
                ? `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`.trim()
                : null,
            receiptNumber: payment.receipt?.receiptNumber ?? null,
            receiptStatus: payment.receipt?.status ?? null,
            invoiceCount: payment.paymentInvoices.length,
            students: [...names].join("، "),
        };
    });
    return { rows, total };
};
exports.fetchPaymentRows = fetchPaymentRows;
const fetchReceiptRows = async (query, request, sort) => {
    const { range } = (0, reports_scope_1.resolvePeriod)(query);
    /*
     * الإيصالُ لا يحمل تاريخَ عملية؛ يحمل `createdAt` وحدها. فيُفلتر
     * بتاريخ **دفعته** — والإيصالُ يُصدَر عن دفعةٍ فيتبعها زمنياً.
     *
     * §24: الملغاةُ تبقى في التقرير. لا تُحذف من التدقيق.
     */
    const where = {
        ...(range
            ? { payment: { paymentDate: { gte: range.from, lte: range.to } } }
            : {}),
    };
    const [total, receipts] = await client_1.prisma.$transaction([
        client_1.prisma.receipt.count({ where }),
        client_1.prisma.receipt.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                receiptNumber: true,
                status: true,
                printed: true,
                printedAt: true,
                cancelledAt: true,
                printedBy: { select: { firstName: true, lastName: true } },
                payment: {
                    select: {
                        paymentNumber: true,
                        amount: true,
                        paymentInvoices: {
                            take: 1,
                            select: {
                                invoice: {
                                    select: {
                                        studentEnrollment: {
                                            select: {
                                                student: {
                                                    select: { firstName: true, lastName: true },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }),
    ]);
    const rows = receipts.map((receipt) => {
        const student = receipt.payment.paymentInvoices[0]?.invoice.studentEnrollment.student;
        return {
            id: receipt.id,
            receiptNumber: receipt.receiptNumber,
            paymentNumber: receipt.payment.paymentNumber,
            studentName: student
                ? `${student.firstName} ${student.lastName}`.trim()
                : "—",
            amount: (0, reporting_1.toNumber)(receipt.payment.amount),
            status: receipt.status,
            printed: receipt.printed,
            printedAt: receipt.printedAt?.toISOString() ?? null,
            printedBy: receipt.printedBy
                ? `${receipt.printedBy.firstName} ${receipt.printedBy.lastName}`.trim()
                : null,
            cancelledAt: receipt.cancelledAt?.toISOString() ?? null,
        };
    });
    return { rows, total };
};
exports.fetchReceiptRows = fetchReceiptRows;
const receiptCounts = async (query) => {
    const { range } = (0, reports_scope_1.resolvePeriod)(query);
    const where = range
        ? { payment: { paymentDate: { gte: range.from, lte: range.to } } }
        : {};
    const [byStatus, printed, total] = await Promise.all([
        client_1.prisma.receipt.groupBy({ by: ["status"], where, _count: true }),
        client_1.prisma.receipt.count({ where: { ...where, printed: true } }),
        client_1.prisma.receipt.count({ where }),
    ]);
    const of = (status) => byStatus.find((row) => row.status === status)?._count ?? 0;
    return {
        total,
        active: of("ACTIVE"),
        cancelled: of("CANCELLED"),
        reprinted: of("REPRINTED"),
        printed,
        notPrinted: total - printed,
    };
};
exports.receiptCounts = receiptCounts;
const fetchDebtRows = async (query, reference, request, sort) => {
    /*
     * الدَّينُ كلُّ متبقٍّ لا القديمُ وحده.
     *
     * `oldDebtScope` يقصره على ما سبق فترةَ المرجع — وهو تعريفُ
     * «الدَّين القديم» لا «الدَّين». والجدولُ يعرض الاثنين ويميّزهما
     * بعمود العمر، فتُرى الشجرةُ والغابة معاً.
     */
    const where = {
        ...(0, reports_scope_1.invoiceScope)(query),
        remaining: { gt: 0 },
    };
    const [total, invoices] = await client_1.prisma.$transaction([
        client_1.prisma.invoice.count({ where }),
        client_1.prisma.invoice.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
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
                        student: { select: { firstName: true, lastName: true } },
                        teachingAssignment: {
                            select: { subject: { select: { name: true } } },
                        },
                    },
                },
            },
        }),
    ]);
    const rows = invoices.map((invoice) => {
        const age = (0, reporting_1.debtAgeInMonths)({ month: invoice.month, year: invoice.year }, reference);
        const totalValue = (0, reporting_1.toNumber)(invoice.total);
        const remaining = (0, reporting_1.toNumber)(invoice.remaining);
        return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            studentName: `${invoice.studentEnrollment.student.firstName} ${invoice.studentEnrollment.student.lastName}`.trim(),
            subject: invoice.studentEnrollment.teachingAssignment.subject.name,
            originalMonth: invoice.month,
            originalYear: invoice.year,
            total: totalValue,
            paid: totalValue - remaining,
            remaining,
            ageInMonths: age,
            ageBucket: (0, reporting_1.debtAgeBucket)(age),
            status: invoice.status,
        };
    });
    return { rows, total };
};
exports.fetchDebtRows = fetchDebtRows;
/**
 * تعتيقُ الدَّين — §25.
 *
 * يُحسب في الذاكرة على **كلّ** الفواتير المدينة لا على الصفحة:
 * الرسمُ يصف المؤسسةَ لا الصفحة. والحقلان المجلوبان اثنان فقط
 * فالمنقولُ صغير.
 *
 * ولا يُحسب في SQL لأنّ الشرائح تعتمد على فارقٍ بين (شهر، سنة)
 * وفترةِ مرجعٍ متغيّرة — تعبيرٌ لا يستعمل الفهرس، فحسابُه في
 * القاعدة أبطأ لا أسرع.
 */
const debtAging = async (query, reference) => {
    const invoices = await client_1.prisma.invoice.findMany({
        where: { ...(0, reports_scope_1.invoiceScope)(query), remaining: { gt: 0 } },
        select: { month: true, year: true, remaining: true },
    });
    const buckets = new Map();
    for (const invoice of invoices) {
        const bucket = (0, reporting_1.debtAgeBucket)((0, reporting_1.debtAgeInMonths)({ month: invoice.month, year: invoice.year }, reference));
        const current = buckets.get(bucket) ?? { amount: 0, count: 0 };
        current.amount += (0, reporting_1.toNumber)(invoice.remaining);
        current.count += 1;
        buckets.set(bucket, current);
    }
    return buckets;
};
exports.debtAging = debtAging;
const fetchDebtCollectionRows = async (query, request, sort) => {
    const { range } = (0, reports_scope_1.resolvePeriod)(query);
    /*
     * الشرطُ على `collectedAt` لا على شهر الفاتورة: التحصيلُ واقعةٌ
     * في يومه، والفاتورةُ تبقى في شهرها الأصلي (§52.7). ولذلك يعرض
     * الجدولُ العمودين معاً — «دُفع في نوفمبر عن سبتمبر».
     */
    const where = {
        ...reporting_1.activeDebtCollection,
        ...(range ? { collectedAt: { gte: range.from, lte: range.to } } : {}),
    };
    const [total, collections] = await client_1.prisma.$transaction([
        client_1.prisma.debtCollection.count({ where }),
        client_1.prisma.debtCollection.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                collectedAmount: true,
                collectedAt: true,
                originalMonth: true,
                originalYear: true,
                payment: { select: { paymentNumber: true } },
                invoice: {
                    select: {
                        invoiceNumber: true,
                        studentEnrollment: {
                            select: {
                                student: { select: { firstName: true, lastName: true } },
                            },
                        },
                    },
                },
                teacherShares: {
                    where: { status: { not: "CANCELLED" } },
                    select: { shareAmount: true },
                },
            },
        }),
    ]);
    const rows = collections.map((collection) => ({
        id: collection.id,
        invoiceNumber: collection.invoice.invoiceNumber,
        studentName: `${collection.invoice.studentEnrollment.student.firstName} ${collection.invoice.studentEnrollment.student.lastName}`.trim(),
        originalMonth: collection.originalMonth,
        originalYear: collection.originalYear,
        collectedAmount: (0, reporting_1.toNumber)(collection.collectedAmount),
        collectedAt: collection.collectedAt.toISOString(),
        paymentNumber: collection.payment.paymentNumber,
        teacherShareCount: collection.teacherShares.length,
        teacherShareAmount: collection.teacherShares.reduce((sum, share) => sum + (0, reporting_1.toNumber)(share.shareAmount), 0),
    }));
    return { rows, total };
};
exports.fetchDebtCollectionRows = fetchDebtCollectionRows;
// --------------------------------------------------
// الفواتير — تجميعٌ بالمادة، لرسم §22
// --------------------------------------------------
const revenueBySubject = async (query) => {
    /*
     * لا `groupBy` على حقلٍ عبر علاقة في Prisma. فالتجميعُ بالإسناد
     * أوّلاً — وهو مفتاحٌ مباشر — ثمّ يُطوى إلى المادة في الذاكرة.
     *
     * والتسجيلُ وسيطٌ بين الفاتورة والإسناد، فالجسرُ استعلامان لا
     * حلقة: تسجيلاتُ الصفحة، ثمّ إسناداتُها بموادّها.
     */
    const byEnrollment = await client_1.prisma.invoice.groupBy({
        by: ["studentEnrollmentId"],
        where: (0, reports_scope_1.invoiceScope)(query),
        _sum: { total: true, remaining: true },
    });
    if (byEnrollment.length === 0)
        return [];
    const enrollments = await client_1.prisma.studentEnrollment.findMany({
        where: { id: { in: byEnrollment.map((row) => row.studentEnrollmentId) } },
        select: {
            id: true,
            teachingAssignment: {
                select: { subject: { select: { id: true, name: true } } },
            },
        },
    });
    const subjectOf = new Map(enrollments.map((row) => [row.id, row.teachingAssignment.subject]));
    const totals = new Map();
    for (const row of byEnrollment) {
        const subject = subjectOf.get(row.studentEnrollmentId);
        if (!subject)
            continue;
        const current = totals.get(subject.id) ?? {
            id: subject.id,
            name: subject.name,
            invoiced: 0,
            remaining: 0,
        };
        current.invoiced += (0, reporting_1.toNumber)(row._sum.total);
        current.remaining += (0, reporting_1.toNumber)(row._sum.remaining);
        totals.set(subject.id, current);
    }
    return [...totals.values()].sort((a, b) => b.invoiced - a.invoiced);
};
exports.revenueBySubject = revenueBySubject;
exports.oldDebtRows = reports_scope_1.oldDebtScope;
//# sourceMappingURL=reports.rows.finance.js.map