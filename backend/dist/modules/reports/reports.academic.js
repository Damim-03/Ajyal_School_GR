"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionCounts = exports.fetchSessionRows = exports.aggregateAcademic = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
const reports_scope_1 = require("./reports.scope");
const reports_table_1 = require("./reports.table");
/**
 * مفتاحُ التجميع واسمُه ووصفُه لكلّ بُعد.
 *
 * جدولٌ صريح لا `switch` متناثر: من يضيف بُعداً يكتب سطراً واحداً،
 * ومن يراجع يرى الأبعادَ الخمسةَ جنباً إلى جنب فيلاحظ اختلافاً
 * غيرَ مقصود.
 */
const DIMENSION = {
    educationStage: (a) => ({
        id: a.studyGroup.level.educationStage.id,
        name: a.studyGroup.level.educationStage.name,
        context: null,
    }),
    level: (a) => ({
        id: a.studyGroup.level.id,
        name: a.studyGroup.level.name,
        context: a.studyGroup.level.educationStage.name,
    }),
    subject: (a) => ({ id: a.subject.id, name: a.subject.name, context: null }),
    studyGroup: (a) => ({
        id: a.studyGroup.id,
        name: a.studyGroup.name,
        context: `${a.studyGroup.level.name} — ${a.studyGroup.level.educationStage.name}`,
    }),
    teachingAssignment: (a) => ({
        id: a.id,
        name: `${a.subject.name} — ${a.studyGroup.name}`,
        context: `${a.teacher.firstName} ${a.teacher.lastName}`.trim(),
    }),
};
/**
 * التجميعُ الأكاديمي — أربعةُ استعلاماتٍ مهما كان عددُ الأبعاد.
 *
 * الترتيب:
 *   1. الإسناداتُ داخل النطاق (استعلام)
 *   2. تسجيلاتُها مجمَّعةً بالإسناد (استعلام)
 *   3. حضورُها مجمَّعاً بـ(إسناد × حالة) — عبر التسجيل (استعلام)
 *   4. فواتيرُها مجمَّعةً بالتسجيل (استعلام)
 *   5. حصصُها مجمَّعةً بالجدول (استعلام)
 *
 * ثمّ يُطوى الكلُّ إلى البُعد المطلوب في الذاكرة. والخرائطُ تجعل
 * الطيَّ خطّياً لا تربيعياً.
 */
const aggregateAcademic = async (query, dimension) => {
    const assignments = await client_1.prisma.teachingAssignment.findMany({
        where: (0, reports_scope_1.teachingAssignmentScope)(query),
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
    });
    if (assignments.length === 0)
        return [];
    const assignmentIds = assignments.map((row) => row.id);
    const [enrollments, attendanceRows, invoiceRows, sessions] = await Promise.all([
        client_1.prisma.studentEnrollment.findMany({
            where: { teachingAssignmentId: { in: assignmentIds } },
            select: { id: true, teachingAssignmentId: true },
        }),
        /*
         * الحضورُ يُجلب صفّاً صفّاً بحقلين اثنين لا يُجمَّع في القاعدة.
         *
         * و`groupBy` لا يقبل التجميعَ على حقلٍ عبر علاقة، والحضورُ
         * يرتبط بالإسناد عبر التسجيل. فالبديلُ استعلامٌ لكلّ إسناد —
         * وهو N+1 بعينه. والمنقولُ هنا حقلان لكلّ سجلّ، فالكلفةُ
         * شبكةٌ لا حسابٌ في القاعدة.
         */
        client_1.prisma.attendance.findMany({
            where: {
                ...(0, reports_scope_1.attendanceScope)(query),
                studentEnrollment: {
                    teachingAssignmentId: { in: assignmentIds },
                },
            },
            select: {
                status: true,
                studentEnrollment: { select: { teachingAssignmentId: true } },
            },
        }),
        client_1.prisma.invoice.groupBy({
            by: ["studentEnrollmentId"],
            where: {
                ...(0, reports_scope_1.invoiceScope)(query),
                studentEnrollment: { teachingAssignmentId: { in: assignmentIds } },
            },
            _sum: { total: true, remaining: true },
        }),
        client_1.prisma.session.findMany({
            where: {
                ...(0, reports_scope_1.sessionScope)(query),
                schedule: { teachingAssignmentId: { in: assignmentIds } },
            },
            select: { schedule: { select: { teachingAssignmentId: true } } },
        }),
    ]);
    const assignmentOfEnrollment = new Map(enrollments.map((row) => [row.id, row.teachingAssignmentId]));
    /* الطيُّ إلى البُعد */
    const buckets = new Map();
    const bucketOfAssignment = new Map();
    for (const assignment of assignments) {
        const key = DIMENSION[dimension](assignment);
        bucketOfAssignment.set(assignment.id, key.id);
        const bucket = buckets.get(key.id) ?? {
            id: key.id,
            name: key.name,
            context: key.context,
            students: 0,
            assignments: 0,
            sessions: 0,
            attendance: (0, reporting_1.emptyAttendanceCounts)(),
            attendanceRate: null,
            invoiced: 0,
            collected: 0,
            outstanding: 0,
        };
        bucket.assignments += 1;
        buckets.set(key.id, bucket);
    }
    /*
     * الطلبةُ يُعدّون بلا تكرار داخل البُعد.
     *
     * طالبٌ مسجَّلٌ في ثلاث موادّ من نفس الطور هو **طالبٌ واحد** في
     * تقرير الأطوار وثلاثةُ تسجيلاتٍ في تقرير الإسنادات. والعدُّ
     * المباشر للتسجيلات كان سيضخّم عددَ طلبة الطور ثلاثةَ أضعاف.
     *
     * ولذلك تُجمع معرّفاتُ الطلبة في مجموعةٍ لكلّ بُعد ثمّ يُقاس
     * حجمُها. وهذا يحتاج معرّفَ الطالب لا التسجيل، فيُقرأ معه.
     */
    const studentsByBucket = new Map();
    const enrollmentOwners = enrollments.length
        ? await client_1.prisma.studentEnrollment.findMany({
            where: { id: { in: enrollments.map((row) => row.id) } },
            select: { id: true, studentId: true, teachingAssignmentId: true },
        })
        : [];
    for (const row of enrollmentOwners) {
        const bucketId = bucketOfAssignment.get(row.teachingAssignmentId);
        if (!bucketId)
            continue;
        const set = studentsByBucket.get(bucketId) ?? new Set();
        set.add(row.studentId);
        studentsByBucket.set(bucketId, set);
    }
    for (const record of attendanceRows) {
        const bucketId = bucketOfAssignment.get(record.studentEnrollment.teachingAssignmentId);
        const bucket = bucketId ? buckets.get(bucketId) : undefined;
        if (!bucket)
            continue;
        bucket.attendance[record.status] += 1;
    }
    for (const row of invoiceRows) {
        const assignmentId = assignmentOfEnrollment.get(row.studentEnrollmentId);
        const bucketId = assignmentId
            ? bucketOfAssignment.get(assignmentId)
            : undefined;
        const bucket = bucketId ? buckets.get(bucketId) : undefined;
        if (!bucket)
            continue;
        const invoiced = (0, reporting_1.toNumber)(row._sum.total);
        const remaining = (0, reporting_1.toNumber)(row._sum.remaining);
        bucket.invoiced += invoiced;
        bucket.collected += invoiced - remaining;
        bucket.outstanding += remaining;
    }
    for (const session of sessions) {
        const bucketId = bucketOfAssignment.get(session.schedule.teachingAssignmentId);
        const bucket = bucketId ? buckets.get(bucketId) : undefined;
        if (!bucket)
            continue;
        bucket.sessions += 1;
    }
    for (const [bucketId, bucket] of buckets) {
        bucket.students = studentsByBucket.get(bucketId)?.size ?? 0;
        bucket.attendanceRate = (0, reporting_1.attendance)(bucket.attendance).attendanceRate;
    }
    return [...buckets.values()].sort((a, b) => b.students - a.students);
};
exports.aggregateAcademic = aggregateAcademic;
const fetchSessionRows = async (query, request, sort) => {
    const where = (0, reports_scope_1.sessionScope)(query);
    const [total, sessions] = await client_1.prisma.$transaction([
        client_1.prisma.session.count({ where }),
        client_1.prisma.session.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                sessionDate: true,
                lessonNumber: true,
                status: true,
                note: true,
                _count: { select: { attendances: true } },
                schedule: {
                    select: {
                        teachingAssignment: {
                            select: {
                                subject: { select: { name: true } },
                                teacher: { select: { firstName: true, lastName: true } },
                                studyGroup: { select: { name: true } },
                                _count: { select: { enrollments: true } },
                            },
                        },
                    },
                },
            },
        }),
    ]);
    const rows = sessions.map((session) => {
        const assignment = session.schedule.teachingAssignment;
        return {
            id: session.id,
            sessionDate: session.sessionDate.toISOString(),
            lessonNumber: session.lessonNumber,
            subject: assignment.subject.name,
            teacher: `${assignment.teacher.firstName} ${assignment.teacher.lastName}`.trim(),
            studyGroup: assignment.studyGroup.name,
            status: session.status,
            /*
             * §17: وجودُ الحصّة لا يساوي تسجيلَ حضورها.
             *
             * فالعمودان يُعرضان معاً — المسجَّل والمتوقَّع — ويظهر النقصُ
             * بالنظر. وعرضُ «عدد الحصص» وحده كان سيوهم بأنّ كلَّ حصّةٍ
             * وُثّق حضورُها.
             */
            attendanceRecorded: session._count.attendances,
            enrolledStudents: assignment._count.enrollments,
            note: session.note,
        };
    });
    return { rows, total };
};
exports.fetchSessionRows = fetchSessionRows;
const sessionCounts = async (query) => {
    const where = (0, reports_scope_1.sessionScope)(query);
    const [byStatus, total, withoutAttendance] = await Promise.all([
        client_1.prisma.session.groupBy({ by: ["status"], where, _count: true }),
        client_1.prisma.session.count({ where }),
        client_1.prisma.session.count({ where: { ...where, attendances: { none: {} } } }),
    ]);
    const of = (status) => byStatus.find((row) => row.status === status)?._count ?? 0;
    return {
        total,
        scheduled: of("SCHEDULED"),
        completed: of("COMPLETED"),
        cancelled: of("CANCELLED"),
        withoutAttendance,
        withAttendance: total - withoutAttendance,
        byStatus,
    };
};
exports.sessionCounts = sessionCounts;
//# sourceMappingURL=reports.academic.js.map