"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyAttendanceCounts = exports.fetchSettlementDetail = exports.fetchTeacherDetail = exports.fetchStudentDetail = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
Object.defineProperty(exports, "emptyAttendanceCounts", { enumerable: true, get: function () { return reporting_1.emptyAttendanceCounts; } });
const reports_table_1 = require("./reports.table");
// ======================================================
// تقاريرُ الكيان الواحد — §9 §28 §30
//
// خطران يعالجهما هذا الملف:
//
//   1. **N+1 مضاعف.** شاشةُ الطالب تعرض تسجيلاته وحضوره وفواتيره
//      ودفعاته. والطريقةُ الساذجة تسأل عن كلٍّ منها لكلّ تسجيل —
//      طالبٌ في خمس موادّ يُكلّف عشرين استعلاماً. فالنمطُ هنا:
//      استعلامٌ واحد لكلّ نوع، مقيَّدٌ بمعرّفات هذا الطالب وحده.
//
//   2. **الاقتطاعُ الصامت.** الجداولُ الفرعية تُقتطع (آخرُ عشرين
//      دفعة، آخرُ خمسين حضوراً) لئلّا تنقل الشاشةُ آلافَ الصفوف.
//      والاقتطاعُ يُعلَن في `shown` و `total`، فيعرف القارئ أنّه
//      يرى طرفاً لا كلّاً — وإلّا قرأ «ثلاث دفعات» على طالبٍ له
//      ثلاثون.
// ======================================================
const fullName = (person) => `${person.firstName} ${person.lastName}`.trim();
const iso = (date) => date?.toISOString() ?? null;
/** حدُّ الجداول الفرعية — طرفٌ يكفي للفهم بلا إغراق */
const DETAIL_ROW_LIMIT = 50;
// ======================================================
// تفصيلُ الطالب — §9
// ======================================================
const fetchStudentDetail = async (studentId, academicYearId) => {
    const student = await client_1.prisma.student.findUnique({
        where: { id: studentId },
        select: {
            id: true,
            studentNumber: true,
            firstName: true,
            lastName: true,
            gender: true,
            birthDate: true,
            birthPlace: true,
            phone: true,
            parentPhone: true,
            emergencyPhone: true,
            address: true,
            schoolName: true,
            registrationDate: true,
            registrationFeePaid: true,
            registrationFeeAmount: true,
            registrationFeePaidAt: true,
            isActive: true,
            note: true,
            level: {
                select: {
                    id: true,
                    name: true,
                    educationStage: { select: { id: true, name: true } },
                },
            },
        },
    });
    if (!student)
        return null;
    /*
     * التسجيلاتُ أوّلاً لأنّ ما بعدها يُقيَّد بمعرّفاتها.
     *
     * والسنةُ الدراسية تُصفّي الإسنادات: طالبٌ درس سنتين له تسجيلاتٌ
     * في كلتيهما، وخلطُهما في شاشةٍ واحدة يُظهر مواداً تركها.
     */
    const enrollments = await client_1.prisma.studentEnrollment.findMany({
        where: {
            studentId,
            ...(academicYearId
                ? { teachingAssignment: { academicYearId } }
                : {}),
        },
        select: {
            id: true,
            isActive: true,
            enrolledAt: true,
            note: true,
            transferAt: true,
            teachingAssignment: {
                select: {
                    id: true,
                    subject: { select: { id: true, name: true } },
                    teacher: { select: { id: true, firstName: true, lastName: true } },
                    studyGroup: {
                        select: {
                            id: true,
                            name: true,
                            level: {
                                select: {
                                    id: true,
                                    name: true,
                                    educationStage: { select: { id: true, name: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { enrolledAt: "desc" },
    });
    const enrollmentIds = enrollments.map((row) => row.id);
    /*
     * أربعةُ استعلاماتٍ متوازية، كلُّها مقيَّدةٌ بتسجيلات هذا الطالب.
     *
     * ولا خامسَ لها: الدفعاتُ تُقرأ عبر `PaymentInvoice` في نفس
     * استعلام الفواتير لو أمكن — لكنّها كيانٌ مستقلّ بتاريخه، فتُجلب
     * على حدة وتُربط بالفواتير في الذاكرة.
     */
    const [attendanceRows, invoices, payments, oldDebts] = await Promise.all([
        enrollmentIds.length
            ? client_1.prisma.attendance.groupBy({
                by: ["status"],
                where: { studentEnrollmentId: { in: enrollmentIds } },
                _count: true,
            })
            : Promise.resolve([]),
        enrollmentIds.length
            ? client_1.prisma.invoice.findMany({
                where: {
                    studentEnrollmentId: { in: enrollmentIds },
                    status: { not: "CANCELLED" },
                },
                select: {
                    id: true,
                    invoiceNumber: true,
                    month: true,
                    year: true,
                    total: true,
                    remaining: true,
                    status: true,
                    dueDate: true,
                    studentEnrollment: {
                        select: {
                            teachingAssignment: {
                                select: { subject: { select: { name: true } } },
                            },
                        },
                    },
                },
                orderBy: [{ year: "desc" }, { month: "desc" }],
                take: DETAIL_ROW_LIMIT,
            })
            : Promise.resolve([]),
        enrollmentIds.length
            ? client_1.prisma.payment.findMany({
                where: {
                    status: "ACTIVE",
                    paymentInvoices: {
                        some: { invoice: { studentEnrollmentId: { in: enrollmentIds } } },
                    },
                },
                select: {
                    id: true,
                    paymentNumber: true,
                    amount: true,
                    paymentMethod: true,
                    paymentDate: true,
                    receipt: { select: { receiptNumber: true } },
                },
                orderBy: { paymentDate: "desc" },
                take: DETAIL_ROW_LIMIT,
            })
            : Promise.resolve([]),
        enrollmentIds.length
            ? client_1.prisma.invoice.aggregate({
                where: {
                    studentEnrollmentId: { in: enrollmentIds },
                    status: { not: "CANCELLED" },
                },
                _sum: { total: true, remaining: true },
                _count: true,
            })
            : Promise.resolve({
                _sum: { total: null, remaining: null },
                _count: 0,
            }),
    ]);
    const counts = (0, reporting_1.countsFromGroupBy)(attendanceRows.map((row) => ({ status: row.status, _count: row._count })));
    const invoiced = (0, reporting_1.toNumber)(oldDebts._sum.total);
    const remaining = (0, reporting_1.toNumber)(oldDebts._sum.remaining);
    /*
     * الطورُ والمستوى من التسجيل النشط لا من `Student.level`.
     *
     * الحقلُ على الطالب اختياريٌّ وقد يتخلّف عن الواقع؛ والفوجُ هو
     * ما يحدّد مستواه فعلاً. فيُقرأ من أوّل تسجيلٍ نشط، ويسقط إلى
     * حقل الطالب حين لا تسجيل.
     */
    const activeEnrollment = enrollments.find((row) => row.isActive);
    const groupLevel = activeEnrollment?.teachingAssignment.studyGroup.level;
    const identity = [
        { label: "رقم الطالب", value: student.studentNumber, type: "text" },
        { label: "الاسم", value: fullName(student), type: "text" },
        {
            label: "الجنس",
            value: student.gender === "MALE" ? "ذكر" : "أنثى",
            type: "status",
        },
        { label: "تاريخ الميلاد", value: iso(student.birthDate), type: "date" },
        { label: "مكان الميلاد", value: student.birthPlace, type: "text" },
        {
            label: "الحالة",
            value: student.isActive ? "نشط" : "غير نشط",
            type: "status",
        },
    ];
    const contact = [
        { label: "هاتف الطالب", value: student.phone, type: "phone" },
        { label: "هاتف الوليّ", value: student.parentPhone, type: "phone" },
        { label: "هاتف الطوارئ", value: student.emergencyPhone, type: "phone" },
        { label: "العنوان", value: student.address, type: "text" },
        { label: "المدرسة الأصلية", value: student.schoolName, type: "text" },
    ];
    const academic = [
        {
            label: "الطور",
            value: groupLevel?.educationStage.name ??
                student.level?.educationStage.name ??
                null,
            type: "text",
            ...(groupLevel?.educationStage.id
                ? {
                    link: {
                        to: "/reports/students",
                        param: "educationStageId",
                        value: groupLevel.educationStage.id,
                    },
                }
                : {}),
        },
        {
            label: "المستوى",
            value: groupLevel?.name ?? student.level?.name ?? null,
            type: "text",
            ...(groupLevel?.id
                ? {
                    link: {
                        to: "/reports/students",
                        param: "levelId",
                        value: groupLevel.id,
                    },
                }
                : {}),
        },
        { label: "عدد التسجيلات", value: enrollments.length, type: "number" },
        {
            label: "التسجيلات النشطة",
            value: enrollments.filter((row) => row.isActive).length,
            type: "number",
        },
        {
            label: "تاريخ التسجيل",
            value: iso(student.registrationDate),
            type: "date",
        },
    ];
    const registration = [
        {
            label: "رسوم التسجيل",
            value: student.registrationFeePaid ? "مدفوعة" : "غير مدفوعة",
            type: "status",
        },
        {
            label: "قيمة الرسوم",
            value: student.registrationFeeAmount
                ? (0, reporting_1.toNumber)(student.registrationFeeAmount)
                : null,
            type: "money",
        },
        {
            label: "تاريخ الدفع",
            value: iso(student.registrationFeePaidAt),
            type: "date",
        },
    ];
    const attendanceSummary = (0, reporting_1.attendance)(counts);
    const detail = {
        id: student.id,
        kind: "student",
        title: fullName(student),
        subtitle: student.studentNumber,
        sections: [
            { key: "identity", title: "الهوية", fields: identity },
            { key: "contact", title: "الاتصال", fields: contact },
            { key: "academic", title: "الأكاديمي", fields: academic },
            { key: "registration", title: "رسوم التسجيل", fields: registration },
            {
                key: "attendance",
                title: "الحضور",
                fields: [
                    { label: "حاضر", value: counts.PRESENT, type: "number" },
                    { label: "غائب", value: counts.ABSENT, type: "number" },
                    { label: "متأخّر", value: counts.LATE, type: "number" },
                    { label: "معذور", value: counts.EXCUSED, type: "number" },
                    {
                        label: "نسبة الحضور",
                        value: attendanceSummary.attendanceRate,
                        type: "percent",
                    },
                ],
            },
            {
                key: "financial",
                title: "المالي",
                fields: [
                    { label: "إجمالي المفوتر", value: invoiced, type: "money" },
                    { label: "المسدَّد", value: invoiced - remaining, type: "money" },
                    { label: "المتبقّي", value: remaining, type: "money" },
                    { label: "عدد الفواتير", value: oldDebts._count, type: "number" },
                ],
            },
            ...(student.note
                ? [
                    {
                        key: "note",
                        title: "ملاحظة",
                        fields: [
                            { label: "الملاحظة", value: student.note, type: "text" },
                        ],
                    },
                ]
                : []),
        ],
        tables: [
            {
                key: "enrollments",
                title: "التسجيلات",
                columns: [
                    (0, reports_table_1.column)("subject", "المادة", "text"),
                    (0, reports_table_1.column)("teacher", "الأستاذ", "text"),
                    (0, reports_table_1.column)("studyGroup", "الفوج", "text"),
                    (0, reports_table_1.column)("enrolledAt", "تاريخ التسجيل", "date"),
                    (0, reports_table_1.column)("status", "الحالة", "status"),
                    (0, reports_table_1.column)("note", "ملاحظة", "text"),
                ],
                rows: enrollments.map((row) => ({
                    id: row.id,
                    subject: row.teachingAssignment.subject.name,
                    teacher: fullName(row.teachingAssignment.teacher),
                    studyGroup: row.teachingAssignment.studyGroup.name,
                    enrolledAt: iso(row.enrolledAt),
                    status: row.isActive ? "نشط" : "منتهٍ",
                    note: row.note,
                })),
                shown: enrollments.length,
                total: enrollments.length,
            },
            {
                key: "invoices",
                title: "الفواتير",
                columns: [
                    (0, reports_table_1.column)("invoiceNumber", "الرقم", "text"),
                    (0, reports_table_1.column)("subject", "المادة", "text"),
                    (0, reports_table_1.column)("month", "الشهر", "number"),
                    (0, reports_table_1.column)("year", "السنة", "number"),
                    (0, reports_table_1.column)("total", "الإجمالي", "money"),
                    (0, reports_table_1.column)("remaining", "المتبقّي", "money"),
                    (0, reports_table_1.column)("status", "الحالة", "status"),
                ],
                rows: invoices.map((invoice) => ({
                    id: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    subject: invoice.studentEnrollment.teachingAssignment.subject.name,
                    month: invoice.month,
                    year: invoice.year,
                    total: (0, reporting_1.toNumber)(invoice.total),
                    remaining: (0, reporting_1.toNumber)(invoice.remaining),
                    status: invoice.status,
                })),
                shown: invoices.length,
                total: oldDebts._count,
            },
            {
                key: "payments",
                title: "الدفعات",
                columns: [
                    (0, reports_table_1.column)("paymentNumber", "الرقم", "text"),
                    (0, reports_table_1.column)("amount", "المبلغ", "money"),
                    (0, reports_table_1.column)("paymentMethod", "الطريقة", "status"),
                    (0, reports_table_1.column)("paymentDate", "التاريخ", "date"),
                    (0, reports_table_1.column)("receiptNumber", "الإيصال", "text"),
                ],
                rows: payments.map((payment) => ({
                    id: payment.id,
                    paymentNumber: payment.paymentNumber,
                    amount: (0, reporting_1.toNumber)(payment.amount),
                    paymentMethod: payment.paymentMethod,
                    paymentDate: iso(payment.paymentDate),
                    receiptNumber: payment.receipt?.receiptNumber ?? null,
                })),
                shown: payments.length,
                total: payments.length,
            },
        ],
    };
    return {
        detail,
        attendanceCounts: counts,
        financial: { invoiced, paid: invoiced - remaining, remaining },
    };
};
exports.fetchStudentDetail = fetchStudentDetail;
// ======================================================
// تفصيلُ الأستاذ — §28
// ======================================================
const fetchTeacherDetail = async (teacherId, academicYearId) => {
    const teacher = await client_1.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            gender: true,
            birthDate: true,
            hireDate: true,
            address: true,
            qualification: true,
            specialization: true,
            isActive: true,
        },
    });
    if (!teacher)
        return null;
    const assignmentWhere = {
        teacherId,
        ...(academicYearId ? { academicYearId } : {}),
    };
    const [assignments, settlements, shares, payments] = await Promise.all([
        client_1.prisma.teachingAssignment.findMany({
            where: assignmentWhere,
            select: {
                id: true,
                isActive: true,
                subject: { select: { id: true, name: true } },
                studyGroup: {
                    select: {
                        id: true,
                        name: true,
                        level: { select: { name: true } },
                    },
                },
                _count: { select: { enrollments: true } },
            },
        }),
        client_1.prisma.settlement.findMany({
            where: { teacherId, ...(academicYearId ? { academicYearId } : {}) },
            select: {
                id: true,
                settlementNumber: true,
                status: true,
                teacherAmount: true,
                computedAt: true,
                paidAt: true,
                attendanceSheet: { select: { number: true, label: true } },
                teachingAssignment: {
                    select: { subject: { select: { name: true } } },
                },
                teacherAllocations: {
                    where: { teacherPayment: { status: "ACTIVE" } },
                    select: { amount: true },
                },
            },
            orderBy: { computedAt: "desc" },
            take: DETAIL_ROW_LIMIT,
        }),
        client_1.prisma.teacherDebtShare.findMany({
            where: { teacherId, status: { not: "CANCELLED" } },
            select: {
                id: true,
                shareAmount: true,
                status: true,
                basisSnapshot: true,
                debtCollection: {
                    select: { originalMonth: true, originalYear: true, collectedAt: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: DETAIL_ROW_LIMIT,
        }),
        client_1.prisma.teacherPayment.findMany({
            where: { teacherId, status: "ACTIVE" },
            select: {
                id: true,
                paymentNumber: true,
                amount: true,
                paymentMethod: true,
                paymentDate: true,
                allocations: { select: { amount: true } },
            },
            orderBy: { paymentDate: "desc" },
            take: DETAIL_ROW_LIMIT,
        }),
    ]);
    /*
     * المجاميعُ من تجميعٍ مستقلّ لا من الصفوف المقتطعة.
     *
     * والفرقُ جوهري: الجداولُ أعلاه محدودةٌ بخمسين صفّاً، فجمعُها
     * يُنتج مستحقّاً ناقصاً لأستاذٍ له تخليصاتٌ أكثر. والمجموعُ رقمٌ
     * يُقرأ ويُحاسَب عليه، فلا يُشتقّ من عيّنة.
     */
    const [settlementTotal, shareTotal, allocationTotal] = await Promise.all([
        client_1.prisma.settlement.aggregate({
            where: {
                teacherId,
                status: { not: "CANCELLED" },
                ...(academicYearId ? { academicYearId } : {}),
            },
            _sum: { teacherAmount: true },
            _count: true,
        }),
        client_1.prisma.teacherDebtShare.aggregate({
            where: { teacherId, status: { not: "CANCELLED" } },
            _sum: { shareAmount: true },
            _count: true,
        }),
        client_1.prisma.teacherPaymentAllocation.aggregate({
            where: { teacherPayment: { teacherId, status: "ACTIVE" } },
            _sum: { amount: true },
        }),
    ]);
    const entitlement = (0, reporting_1.toNumber)(settlementTotal._sum.teacherAmount) +
        (0, reporting_1.toNumber)(shareTotal._sum.shareAmount);
    const paid = (0, reporting_1.toNumber)(allocationTotal._sum.amount);
    const studentCount = assignments.reduce((sum, row) => sum + row._count.enrollments, 0);
    const detail = {
        id: teacher.id,
        kind: "teacher",
        title: fullName(teacher),
        subtitle: teacher.specialization,
        sections: [
            {
                key: "identity",
                title: "الهوية",
                fields: [
                    { label: "الاسم", value: fullName(teacher), type: "text" },
                    {
                        label: "الجنس",
                        value: teacher.gender === "MALE" ? "ذكر" : "أنثى",
                        type: "status",
                    },
                    { label: "تاريخ الميلاد", value: iso(teacher.birthDate), type: "date" },
                    { label: "تاريخ التوظيف", value: iso(teacher.hireDate), type: "date" },
                    {
                        label: "الحالة",
                        value: teacher.isActive ? "نشط" : "غير نشط",
                        type: "status",
                    },
                ],
            },
            {
                key: "contact",
                title: "الاتصال",
                fields: [
                    { label: "الهاتف", value: teacher.phone, type: "phone" },
                    { label: "البريد", value: teacher.email, type: "text" },
                    { label: "العنوان", value: teacher.address, type: "text" },
                ],
            },
            {
                key: "qualification",
                title: "المؤهّل",
                fields: [
                    { label: "الشهادة", value: teacher.qualification, type: "text" },
                    { label: "التخصّص", value: teacher.specialization, type: "text" },
                ],
            },
            {
                key: "workload",
                title: "العبء التدريسي",
                fields: [
                    { label: "الإسنادات", value: assignments.length, type: "number" },
                    {
                        label: "الإسنادات النشطة",
                        value: assignments.filter((row) => row.isActive).length,
                        type: "number",
                    },
                    { label: "الطلبة", value: studentCount, type: "number" },
                    {
                        label: "المواد",
                        value: new Set(assignments.map((row) => row.subject.id)).size,
                        type: "number",
                    },
                    {
                        label: "الأفواج",
                        value: new Set(assignments.map((row) => row.studyGroup.id)).size,
                        type: "number",
                    },
                ],
            },
            {
                key: "money",
                title: "المستحقّ والمدفوع",
                fields: [
                    { label: "المستحقّ الكلّي", value: entitlement, type: "money" },
                    {
                        label: "من التخليص",
                        value: (0, reporting_1.toNumber)(settlementTotal._sum.teacherAmount),
                        type: "money",
                    },
                    {
                        label: "من حصص الدَّين",
                        value: (0, reporting_1.toNumber)(shareTotal._sum.shareAmount),
                        type: "money",
                    },
                    { label: "المدفوع", value: paid, type: "money" },
                    { label: "المتبقّي", value: entitlement - paid, type: "money" },
                ],
            },
        ],
        tables: [
            {
                key: "assignments",
                title: "الإسنادات",
                columns: [
                    (0, reports_table_1.column)("subject", "المادة", "text"),
                    (0, reports_table_1.column)("studyGroup", "الفوج", "text"),
                    (0, reports_table_1.column)("level", "المستوى", "text"),
                    (0, reports_table_1.column)("students", "الطلبة", "number"),
                    (0, reports_table_1.column)("status", "الحالة", "status"),
                ],
                rows: assignments.map((row) => ({
                    id: row.id,
                    subject: row.subject.name,
                    studyGroup: row.studyGroup.name,
                    level: row.studyGroup.level.name,
                    students: row._count.enrollments,
                    status: row.isActive ? "نشط" : "منتهٍ",
                })),
                shown: assignments.length,
                total: assignments.length,
            },
            {
                key: "settlements",
                title: "التخليصات",
                columns: [
                    (0, reports_table_1.column)("settlementNumber", "الرقم", "text"),
                    (0, reports_table_1.column)("subject", "المادة", "text"),
                    (0, reports_table_1.column)("sheet", "الكشف", "text"),
                    (0, reports_table_1.column)("teacherAmount", "المستحقّ", "money"),
                    (0, reports_table_1.column)("allocated", "المدفوع", "money"),
                    (0, reports_table_1.column)("status", "الحالة", "status"),
                    (0, reports_table_1.column)("computedAt", "حُسب في", "date"),
                ],
                rows: settlements.map((row) => ({
                    id: row.id,
                    settlementNumber: row.settlementNumber,
                    subject: row.teachingAssignment.subject.name,
                    sheet: row.attendanceSheet.label ?? `كشف ${row.attendanceSheet.number}`,
                    teacherAmount: (0, reporting_1.toNumber)(row.teacherAmount),
                    allocated: row.teacherAllocations.reduce((sum, allocation) => sum + (0, reporting_1.toNumber)(allocation.amount), 0),
                    status: row.status,
                    computedAt: iso(row.computedAt),
                })),
                shown: settlements.length,
                total: settlementTotal._count,
            },
            {
                key: "debtShares",
                title: "حصص الديون المحصَّلة",
                columns: [
                    (0, reports_table_1.column)("period", "فترة الأصل", "text"),
                    (0, reports_table_1.column)("collectedAt", "تاريخ التحصيل", "date"),
                    (0, reports_table_1.column)("basis", "الأساس", "status"),
                    (0, reports_table_1.column)("shareAmount", "الحصّة", "money"),
                    (0, reports_table_1.column)("status", "الحالة", "status"),
                ],
                rows: shares.map((row) => ({
                    id: row.id,
                    period: `${row.debtCollection.originalYear}-${String(row.debtCollection.originalMonth).padStart(2, "0")}`,
                    collectedAt: iso(row.debtCollection.collectedAt),
                    basis: row.basisSnapshot,
                    shareAmount: (0, reporting_1.toNumber)(row.shareAmount),
                    status: row.status,
                })),
                shown: shares.length,
                total: shareTotal._count,
            },
            {
                key: "payments",
                title: "الدفعات",
                columns: [
                    (0, reports_table_1.column)("paymentNumber", "الرقم", "text"),
                    (0, reports_table_1.column)("amount", "المبلغ", "money"),
                    (0, reports_table_1.column)("allocated", "المخصَّص", "money"),
                    (0, reports_table_1.column)("paymentMethod", "الطريقة", "status"),
                    (0, reports_table_1.column)("paymentDate", "التاريخ", "date"),
                ],
                rows: payments.map((row) => ({
                    id: row.id,
                    paymentNumber: row.paymentNumber,
                    amount: (0, reporting_1.toNumber)(row.amount),
                    allocated: row.allocations.reduce((sum, allocation) => sum + (0, reporting_1.toNumber)(allocation.amount), 0),
                    paymentMethod: row.paymentMethod,
                    paymentDate: iso(row.paymentDate),
                })),
                shown: payments.length,
                total: payments.length,
            },
        ],
    };
    return { detail, entitlement, paid };
};
exports.fetchTeacherDetail = fetchTeacherDetail;
// ======================================================
// تفصيلُ التخليص — §30
// ======================================================
const fetchSettlementDetail = async (settlementId) => {
    const settlement = await client_1.prisma.settlement.findUnique({
        where: { id: settlementId },
        select: {
            id: true,
            settlementNumber: true,
            revision: true,
            status: true,
            /* اللقطاتُ كلُّها — §53 */
            methodSnapshot: true,
            countBasisSnapshot: true,
            roundingModeSnapshot: true,
            roundingPrecisionSnapshot: true,
            percentageSnapshot: true,
            perStudentSnapshot: true,
            perSessionSnapshot: true,
            tuitionSnapshot: true,
            approvedSessionsSnapshot: true,
            completedSessionsSnapshot: true,
            studentCountSnapshot: true,
            paidStudentCountSnapshot: true,
            attendedUnitsSnapshot: true,
            grossTuitionSnapshot: true,
            collectedSnapshot: true,
            remainingSnapshot: true,
            teacherAmount: true,
            computedAt: true,
            confirmedAt: true,
            paidAt: true,
            cancelledAt: true,
            cancelReason: true,
            note: true,
            teacher: { select: { id: true, firstName: true, lastName: true } },
            confirmedBy: { select: { firstName: true, lastName: true } },
            paidBy: { select: { firstName: true, lastName: true } },
            cancelledBy: { select: { firstName: true, lastName: true } },
            attendanceSheet: {
                select: { id: true, number: true, label: true, sessionCount: true },
            },
            academicYear: { select: { name: true } },
            teachingAssignment: {
                select: {
                    subject: { select: { id: true, name: true } },
                    studyGroup: { select: { id: true, name: true } },
                },
            },
            /*
             * بنودُ التخليص — تفصيلُ الحصّة بالحصّة.
             *
             * كتبتُ أوّلَ مرّة `amount` فسقط الاستعلام: النموذجُ يحمل
             * `rate` و `lineTotal` و `countedStudents` لا حقلاً واحداً.
             * والحقولُ الحقيقية أثمنُ ممّا افترضت — بها يُرى **كيف**
             * تكوّن المبلغ لا مقدارُه وحده، وهو صلبُ ما يطلبه §30.
             */
            lines: {
                select: {
                    id: true,
                    lessonNumber: true,
                    sessionDate: true,
                    countedStudents: true,
                    rate: true,
                    lineTotal: true,
                },
                orderBy: { lessonNumber: "asc" },
            },
            teacherAllocations: {
                where: { teacherPayment: { status: "ACTIVE" } },
                select: {
                    id: true,
                    amount: true,
                    teacherPayment: {
                        select: { paymentNumber: true, paymentDate: true },
                    },
                },
            },
            documents: { select: { id: true } },
        },
    });
    if (!settlement)
        return null;
    const teacherAmount = (0, reporting_1.toNumber)(settlement.teacherAmount);
    const allocated = settlement.teacherAllocations.reduce((sum, allocation) => sum + (0, reporting_1.toNumber)(allocation.amount), 0);
    /*
     * §30: المؤكَّدُ والمدفوعُ **لا يُعاد حسابهما**.
     *
     * فالشاشةُ لا تعرض «ما سيكون المبلغ بالسياسة الحالية» ولا تقارن
     * به. تعرض اللقطةَ وحدها، ومعها رايةٌ تقول إن كان التخليصُ
     * مجمَّداً — فيعرف القارئ أنّ ما يراه تاريخٌ لا حساب.
     */
    const isFrozen = settlement.status === "CONFIRMED" || settlement.status === "PAID";
    const detail = {
        id: settlement.id,
        kind: "settlement",
        title: settlement.settlementNumber,
        subtitle: fullName(settlement.teacher),
        sections: [
            {
                key: "identity",
                title: "التعريف",
                fields: [
                    { label: "الرقم", value: settlement.settlementNumber, type: "text" },
                    { label: "المراجعة", value: settlement.revision, type: "number" },
                    { label: "الحالة", value: settlement.status, type: "status" },
                    {
                        label: "مجمَّد",
                        value: isFrozen ? "نعم — لا يُعاد حسابه" : "لا — مسوّدة",
                        type: "status",
                    },
                    {
                        label: "الأستاذ",
                        value: fullName(settlement.teacher),
                        type: "text",
                        link: {
                            to: "/reports/teachers",
                            param: "teacherId",
                            value: settlement.teacher.id,
                        },
                    },
                    {
                        label: "المادة",
                        value: settlement.teachingAssignment.subject.name,
                        type: "text",
                    },
                    {
                        label: "الفوج",
                        value: settlement.teachingAssignment.studyGroup.name,
                        type: "text",
                    },
                    {
                        label: "السنة الدراسية",
                        value: settlement.academicYear.name,
                        type: "text",
                    },
                    {
                        label: "الكشف",
                        value: settlement.attendanceSheet.label ??
                            `كشف ${settlement.attendanceSheet.number}`,
                        type: "text",
                    },
                ],
            },
            {
                key: "policySnapshot",
                title: "لقطة السياسة — كما كانت لحظة الحساب",
                fields: [
                    { label: "الطريقة", value: settlement.methodSnapshot, type: "status" },
                    {
                        label: "أساس العدّ",
                        value: settlement.countBasisSnapshot,
                        type: "status",
                    },
                    {
                        label: "نمط التقريب",
                        value: settlement.roundingModeSnapshot,
                        type: "status",
                    },
                    {
                        label: "دقّة التقريب",
                        value: settlement.roundingPrecisionSnapshot,
                        type: "number",
                    },
                    {
                        label: "النسبة",
                        value: settlement.percentageSnapshot
                            ? (0, reporting_1.toNumber)(settlement.percentageSnapshot)
                            : null,
                        type: "percent",
                    },
                    {
                        label: "للطالب الواحد",
                        value: settlement.perStudentSnapshot
                            ? (0, reporting_1.toNumber)(settlement.perStudentSnapshot)
                            : null,
                        type: "money",
                    },
                    {
                        label: "للحصّة الواحدة",
                        value: settlement.perSessionSnapshot
                            ? (0, reporting_1.toNumber)(settlement.perSessionSnapshot)
                            : null,
                        type: "money",
                    },
                ],
            },
            {
                key: "dataSnapshot",
                title: "لقطة المعطيات — كما كانت لحظة الحساب",
                fields: [
                    {
                        label: "الرسم الشهري",
                        value: (0, reporting_1.toNumber)(settlement.tuitionSnapshot),
                        type: "money",
                    },
                    {
                        label: "الحصص المعتمدة",
                        value: settlement.approvedSessionsSnapshot,
                        type: "number",
                    },
                    {
                        label: "الحصص المكتملة",
                        value: settlement.completedSessionsSnapshot,
                        type: "number",
                    },
                    {
                        label: "عدد الطلبة",
                        value: settlement.studentCountSnapshot,
                        type: "number",
                    },
                    {
                        label: "الطلبة المسدِّدون",
                        value: settlement.paidStudentCountSnapshot,
                        type: "number",
                    },
                    {
                        label: "وحدات الحضور",
                        value: settlement.attendedUnitsSnapshot,
                        type: "number",
                    },
                    {
                        label: "إجمالي الرسوم",
                        value: (0, reporting_1.toNumber)(settlement.grossTuitionSnapshot),
                        type: "money",
                    },
                    {
                        label: "المحصَّل",
                        value: (0, reporting_1.toNumber)(settlement.collectedSnapshot),
                        type: "money",
                    },
                    {
                        label: "المتبقّي",
                        value: (0, reporting_1.toNumber)(settlement.remainingSnapshot),
                        type: "money",
                    },
                ],
            },
            {
                key: "result",
                title: "النتيجة",
                fields: [
                    { label: "مستحقّ الأستاذ", value: teacherAmount, type: "money" },
                    { label: "المدفوع", value: allocated, type: "money" },
                    { label: "المتبقّي", value: teacherAmount - allocated, type: "money" },
                    { label: "عدد البنود", value: settlement.lines.length, type: "number" },
                    {
                        label: "الوثائق المرفقة",
                        value: settlement.documents.length,
                        type: "number",
                    },
                ],
            },
            {
                key: "lifecycle",
                title: "دورة الحياة",
                fields: [
                    { label: "حُسب في", value: iso(settlement.computedAt), type: "date" },
                    {
                        label: "أُكّد في",
                        value: iso(settlement.confirmedAt),
                        type: "date",
                    },
                    {
                        label: "أكّده",
                        value: settlement.confirmedBy
                            ? fullName(settlement.confirmedBy)
                            : null,
                        type: "text",
                    },
                    { label: "دُفع في", value: iso(settlement.paidAt), type: "date" },
                    {
                        label: "دفعه",
                        value: settlement.paidBy ? fullName(settlement.paidBy) : null,
                        type: "text",
                    },
                    {
                        label: "أُلغي في",
                        value: iso(settlement.cancelledAt),
                        type: "date",
                    },
                    {
                        label: "ألغاه",
                        value: settlement.cancelledBy
                            ? fullName(settlement.cancelledBy)
                            : null,
                        type: "text",
                    },
                    { label: "سبب الإلغاء", value: settlement.cancelReason, type: "text" },
                ],
            },
        ],
        tables: [
            {
                key: "lines",
                title: "بنود التخليص — حصّةً بحصّة",
                columns: [
                    (0, reports_table_1.column)("lessonNumber", "رقم الحصّة", "number"),
                    (0, reports_table_1.column)("sessionDate", "التاريخ", "date"),
                    (0, reports_table_1.column)("countedStudents", "الطلبة المحتسبون", "number"),
                    (0, reports_table_1.column)("rate", "نصيب الوحدة", "money"),
                    (0, reports_table_1.column)("lineTotal", "مجموع البند", "money"),
                ],
                rows: settlement.lines.map((line) => ({
                    id: line.id,
                    lessonNumber: line.lessonNumber,
                    sessionDate: iso(line.sessionDate),
                    countedStudents: line.countedStudents,
                    rate: (0, reporting_1.toNumber)(line.rate),
                    lineTotal: (0, reporting_1.toNumber)(line.lineTotal),
                })),
                shown: settlement.lines.length,
                total: settlement.lines.length,
            },
            {
                key: "allocations",
                title: "الدفعات المخصَّصة لهذا التخليص",
                columns: [
                    (0, reports_table_1.column)("paymentNumber", "رقم الدفعة", "text"),
                    (0, reports_table_1.column)("paymentDate", "التاريخ", "date"),
                    (0, reports_table_1.column)("amount", "المبلغ", "money"),
                ],
                rows: settlement.teacherAllocations.map((allocation) => ({
                    id: allocation.id,
                    paymentNumber: allocation.teacherPayment.paymentNumber,
                    paymentDate: iso(allocation.teacherPayment.paymentDate),
                    amount: (0, reporting_1.toNumber)(allocation.amount),
                })),
                shown: settlement.teacherAllocations.length,
                total: settlement.teacherAllocations.length,
            },
        ],
    };
    return { detail, teacherAmount };
};
exports.fetchSettlementDetail = fetchSettlementDetail;
//# sourceMappingURL=reports.detail.js.map