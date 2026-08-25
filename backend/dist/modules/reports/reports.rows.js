"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentCounts = exports.fetchTeacherRows = exports.fetchAttendanceRows = exports.fetchStudentRows = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
const reports_scope_1 = require("./reports.scope");
const reports_table_1 = require("./reports.table");
const fetchStudentRows = async (query, request, sort) => {
    const enrollment = (0, reports_scope_1.enrollmentScope)(query);
    /*
     * الطالبُ يدخل الجدول متى كان له تسجيلٌ واحد داخل النطاق.
     *
     * `some` لا `every`: طالبٌ مسجَّلٌ في ثلاث مواد إحداها الرياضيات
     * يظهر في تقرير الرياضيات. و`every` كانت ستقصره على من لا يدرس
     * غيرَها — وهو سؤالٌ آخر لم يطرحه أحد.
     */
    const where = Object.keys(enrollment).length > 0
        ? { enrollments: { some: enrollment } }
        : {};
    const [total, students] = await client_1.prisma.$transaction([
        client_1.prisma.student.count({ where }),
        client_1.prisma.student.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                studentNumber: true,
                firstName: true,
                lastName: true,
                gender: true,
                isActive: true,
                _count: { select: { enrollments: true } },
            },
        }),
    ]);
    const ids = students.map((student) => student.id);
    if (ids.length === 0)
        return { rows: [], total };
    /*
     * التجميعان مقيَّدان بمعرّفات الصفحة.
     *
     * ولولا التقييد لجمع الحضورَ لكلّ طلبة المؤسسة ثم أُهمل أكثرُه —
     * عملٌ يتضخّم مع نموّ المؤسسة بينما الصفحةُ تبقى خمسين صفّاً.
     */
    /*
     * الحضورُ يحتاج ربطاً بالطالب، و`groupBy` على الحالة وحدها لا
     * يعطيه — Prisma لا تجمّع عبر علاقة. فيُجلب تفصيلُ (طالب ×
     * حالة) باستعلامٍ واحد ويُطوى في الذاكرة.
     *
     * والحقلان المختاران اثنان فقط، فالمنقولُ عبر الشبكة صغيرٌ ولو
     * كثرت السجلّات. والبديلُ — استعلامٌ لكلّ طالب — كان خمسين
     * رحلةً لصفحةٍ واحدة.
     */
    const [perStudent, invoiceRows] = await Promise.all([
        client_1.prisma.attendance.findMany({
            where: {
                ...(0, reports_scope_1.attendanceScope)(query),
                studentEnrollment: { studentId: { in: ids } },
            },
            select: {
                status: true,
                studentEnrollment: { select: { studentId: true } },
            },
        }),
        client_1.prisma.invoice.groupBy({
            by: ["studentEnrollmentId"],
            where: {
                ...(0, reports_scope_1.invoiceScope)(query),
                studentEnrollment: { studentId: { in: ids } },
            },
            _sum: { total: true, remaining: true },
        }),
    ]);
    const attendanceByStudent = new Map();
    for (const record of perStudent) {
        const studentId = record.studentEnrollment.studentId;
        const counts = attendanceByStudent.get(studentId) ?? (0, reporting_1.emptyAttendanceCounts)();
        counts[record.status] += 1;
        attendanceByStudent.set(studentId, counts);
    }
    /*
     * الفواتيرُ مجمَّعةٌ بالتسجيل، والتسجيلُ يخصّ طالباً — فيُبنى
     * جسرٌ من التسجيل إلى الطالب باستعلامٍ واحد.
     */
    const enrollmentIds = invoiceRows.map((row) => row.studentEnrollmentId);
    const enrollmentOwners = enrollmentIds.length
        ? await client_1.prisma.studentEnrollment.findMany({
            where: { id: { in: enrollmentIds } },
            select: { id: true, studentId: true },
        })
        : [];
    const ownerOf = new Map(enrollmentOwners.map((row) => [row.id, row.studentId]));
    const moneyByStudent = new Map();
    for (const row of invoiceRows) {
        const studentId = ownerOf.get(row.studentEnrollmentId);
        if (!studentId)
            continue;
        const current = moneyByStudent.get(studentId) ?? { invoiced: 0, remaining: 0 };
        current.invoiced += (0, reporting_1.toNumber)(row._sum.total);
        current.remaining += (0, reporting_1.toNumber)(row._sum.remaining);
        moneyByStudent.set(studentId, current);
    }
    const rows = students.map((student) => {
        const counts = attendanceByStudent.get(student.id);
        const money = moneyByStudent.get(student.id) ?? { invoiced: 0, remaining: 0 };
        return {
            id: student.id,
            studentNumber: student.studentNumber,
            name: `${student.firstName} ${student.lastName}`.trim(),
            gender: student.gender,
            enrollmentCount: student._count.enrollments,
            /*
             * `null` لا صفر حين لا سجلّاتِ حضور — طالبٌ سُجّل ولم تبدأ
             * دراستُه ليس غائباً بنسبة 100%.
             */
            attendanceRate: counts ? (0, reporting_1.attendance)(counts).attendanceRate : null,
            invoiced: money.invoiced,
            paid: money.invoiced - money.remaining,
            outstanding: money.remaining,
            isActive: student.isActive,
        };
    });
    return { rows, total };
};
exports.fetchStudentRows = fetchStudentRows;
const fetchAttendanceRows = async (query, request, sort) => {
    const where = (0, reports_scope_1.attendanceScope)(query);
    /*
     * `include` متداخلٌ في استعلامٍ واحد لا استعلامٌ لكلّ صفّ.
     *
     * Prisma تترجم هذا إلى وصلاتٍ واحدة، فخمسون صفّاً تُكلّف استعلاماً
     * واحداً. وقراءةُ الأستاذ والمادة لكلّ صفٍّ على حدة كانت الـN+1
     * بعينها.
     */
    const [total, records] = await client_1.prisma.$transaction([
        client_1.prisma.attendance.count({ where }),
        client_1.prisma.attendance.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                status: true,
                note: true,
                studentEnrollment: {
                    select: {
                        student: { select: { firstName: true, lastName: true } },
                    },
                },
                session: {
                    select: {
                        sessionDate: true,
                        lessonNumber: true,
                        schedule: {
                            select: {
                                teachingAssignment: {
                                    select: {
                                        subject: { select: { name: true } },
                                        teacher: { select: { firstName: true, lastName: true } },
                                        studyGroup: { select: { name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }),
    ]);
    const rows = records.map((record) => {
        const assignment = record.session.schedule.teachingAssignment;
        return {
            id: record.id,
            studentName: `${record.studentEnrollment.student.firstName} ${record.studentEnrollment.student.lastName}`.trim(),
            subject: assignment.subject.name,
            teacher: `${assignment.teacher.firstName} ${assignment.teacher.lastName}`.trim(),
            studyGroup: assignment.studyGroup.name,
            sessionDate: record.session.sessionDate.toISOString(),
            lessonNumber: record.session.lessonNumber,
            status: record.status,
            note: record.note,
        };
    });
    return { rows, total };
};
exports.fetchAttendanceRows = fetchAttendanceRows;
const fetchTeacherRows = async (query, request, sort) => {
    const where = query.teacherId
        ? { id: query.teacherId }
        : {};
    const [total, teachers] = await client_1.prisma.$transaction([
        client_1.prisma.teacher.count({ where }),
        client_1.prisma.teacher.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                _count: { select: { teachingAssignments: true } },
            },
        }),
    ]);
    const ids = teachers.map((teacher) => teacher.id);
    if (ids.length === 0)
        return { rows: [], total };
    const [settlements, shares, allocations, enrollments] = await Promise.all([
        client_1.prisma.settlement.groupBy({
            by: ["teacherId"],
            where: { teacherId: { in: ids }, status: { not: "CANCELLED" } },
            _sum: { teacherAmount: true },
        }),
        client_1.prisma.teacherDebtShare.groupBy({
            by: ["teacherId"],
            where: { teacherId: { in: ids }, status: { not: "CANCELLED" } },
            _sum: { shareAmount: true },
        }),
        client_1.prisma.teacherPaymentAllocation.groupBy({
            by: ["teacherPaymentId"],
            where: {
                teacherPayment: { teacherId: { in: ids }, status: "ACTIVE" },
            },
            _sum: { amount: true },
        }),
        client_1.prisma.studentEnrollment.groupBy({
            by: ["teachingAssignmentId"],
            where: { teachingAssignment: { teacherId: { in: ids } } },
            _count: true,
        }),
    ]);
    /*
     * التخصيصاتُ مجمَّعةٌ بالدفعة لا بالأستاذ — فيُبنى جسرٌ من الدفعة
     * إلى صاحبها. و`groupBy` لا يقبل التجميعَ عبر علاقة، فالجسرُ
     * استعلامٌ واحدٌ إضافي لا حلقة.
     */
    const paymentIds = allocations.map((row) => row.teacherPaymentId);
    const paymentOwners = paymentIds.length
        ? await client_1.prisma.teacherPayment.findMany({
            where: { id: { in: paymentIds } },
            select: { id: true, teacherId: true },
        })
        : [];
    const teacherOfPayment = new Map(paymentOwners.map((row) => [row.id, row.teacherId]));
    const paidByTeacher = new Map();
    for (const row of allocations) {
        const teacherId = teacherOfPayment.get(row.teacherPaymentId);
        if (!teacherId)
            continue;
        paidByTeacher.set(teacherId, (paidByTeacher.get(teacherId) ?? 0) + (0, reporting_1.toNumber)(row._sum.amount));
    }
    /* التسجيلاتُ مجمَّعةٌ بالإسناد — والجسرُ إلى الأستاذ بنفس النمط */
    const assignmentIds = enrollments.map((row) => row.teachingAssignmentId);
    const assignmentOwners = assignmentIds.length
        ? await client_1.prisma.teachingAssignment.findMany({
            where: { id: { in: assignmentIds } },
            select: { id: true, teacherId: true },
        })
        : [];
    const teacherOfAssignment = new Map(assignmentOwners.map((row) => [row.id, row.teacherId]));
    const studentsByTeacher = new Map();
    for (const row of enrollments) {
        const teacherId = teacherOfAssignment.get(row.teachingAssignmentId);
        if (!teacherId)
            continue;
        studentsByTeacher.set(teacherId, (studentsByTeacher.get(teacherId) ?? 0) + row._count);
    }
    const settlementByTeacher = new Map(settlements.map((row) => [row.teacherId, (0, reporting_1.toNumber)(row._sum.teacherAmount)]));
    const shareByTeacher = new Map(shares.map((row) => [row.teacherId, (0, reporting_1.toNumber)(row._sum.shareAmount)]));
    const rows = teachers.map((teacher) => {
        const entitlement = (settlementByTeacher.get(teacher.id) ?? 0) +
            (shareByTeacher.get(teacher.id) ?? 0);
        const paid = paidByTeacher.get(teacher.id) ?? 0;
        return {
            id: teacher.id,
            name: `${teacher.firstName} ${teacher.lastName}`.trim(),
            assignmentCount: teacher._count.teachingAssignments,
            studentCount: studentsByTeacher.get(teacher.id) ?? 0,
            entitlement,
            paid,
            outstanding: entitlement - paid,
        };
    });
    return { rows, total };
};
exports.fetchTeacherRows = fetchTeacherRows;
// --------------------------------------------------
// أعدادُ الطلبة — §8
// --------------------------------------------------
const studentCounts = async (query) => {
    const enrollment = (0, reports_scope_1.enrollmentScope)(query);
    const scoped = Object.keys(enrollment).length > 0
        ? { enrollments: { some: enrollment } }
        : {};
    const [total, active, byGender, withDebt] = await Promise.all([
        client_1.prisma.student.count({ where: scoped }),
        client_1.prisma.student.count({ where: { ...scoped, isActive: true } }),
        client_1.prisma.student.groupBy({
            by: ["gender"],
            where: scoped,
            _count: true,
        }),
        client_1.prisma.invoice.findMany({
            where: { ...(0, reports_scope_1.invoiceScope)(query), ...reporting_1.activeInvoice, remaining: { gt: 0 } },
            select: { studentEnrollment: { select: { studentId: true } } },
            distinct: ["studentEnrollmentId"],
        }),
    ]);
    return {
        total,
        active,
        inactive: total - active,
        byGender,
        studentsInDebt: new Set(withDebt.map((row) => row.studentEnrollment.studentId))
            .size,
        /** نسبةُ النشطين — `null` حين لا طلبة */
        activeRate: (0, reporting_1.rate)(active, total),
    };
};
exports.studentCounts = studentCounts;
//# sourceMappingURL=reports.rows.js.map