"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherPaymentScope = exports.settlementScope = exports.sessionScope = exports.attendanceScope = exports.paymentScope = exports.oldDebtScope = exports.invoiceScope = exports.enrollmentScope = exports.teachingAssignmentScope = exports.resolvePeriod = void 0;
const reporting_1 = require("../../core/reporting");
/**
 * حلُّ الفترة من الفلاتر.
 *
 * الأولويةُ للشهر الصريح: من اختار «سبتمبر 2026» قصد حقلَي الأعمال،
 * ويُشتقّ منه المدى للكيانات المؤرَّخة باللحظة. ومن أعطى مدىً صريحاً
 * فلا شهرَ له — التقريرُ حينها عابرٌ للأشهر، وإجبارُه على شهرٍ واحد
 * يكذب.
 */
const resolvePeriod = (query) => {
    if (query.month !== undefined && query.year !== undefined) {
        const yearMonth = { year: query.year, month: query.month };
        return { yearMonth, range: (0, reporting_1.monthRange)(yearMonth) };
    }
    if (query.dateFrom || query.dateTo) {
        /*
         * مدىً مفتوحُ الطرف مشروع: «منذ بداية السنة حتى اليوم» يترك
         * `dateTo` فارغاً. فيُملأ الطرفُ الناقص بحدٍّ ثابت لا بـ`new
         * Date()` — لئلّا يتغيّر ناتجُ نفس الاستعلام بين نداءين
         * فتتعذّر مقارنةُ لقطتين.
         */
        const from = query.dateFrom
            ? (0, reporting_1.startOfDay)(query.dateFrom)
            : new Date(1970, 0, 1);
        const to = query.dateTo ? (0, reporting_1.endOfDay)(query.dateTo) : new Date(2999, 11, 31);
        return { yearMonth: null, range: { from, to } };
    }
    return { yearMonth: null, range: null };
};
exports.resolvePeriod = resolvePeriod;
const hasKeys = (value) => Object.keys(value).length > 0;
// ======================================================
// المحور الأكاديمي
// ======================================================
/**
 * شرطُ الإسناد التدريسي — مصدرُ كلّ فلترٍ أكاديمي.
 *
 * المستوى والطور يُقرآن عبر الفوج: الفوجُ يحمل `levelId`، والمستوى
 * يحمل `educationStageId`. ولا يُشتقّ الطورُ من الطالب مباشرةً —
 * طالبٌ قد يُسجَّل في أفواجِ مستوياتٍ مختلفة، والاشتقاقُ من الطالب
 * يخلط تسجيلاتِه.
 */
const teachingAssignmentScope = (query) => {
    const where = {};
    if (query.academicYearId)
        where.academicYearId = query.academicYearId;
    if (query.teacherId)
        where.teacherId = query.teacherId;
    if (query.subjectId)
        where.subjectId = query.subjectId;
    if (query.studyGroupId)
        where.studyGroupId = query.studyGroupId;
    if (query.levelId || query.educationStageId) {
        where.studyGroup = {
            ...(query.levelId ? { levelId: query.levelId } : {}),
            ...(query.educationStageId
                ? { level: { educationStageId: query.educationStageId } }
                : {}),
        };
    }
    return where;
};
exports.teachingAssignmentScope = teachingAssignmentScope;
/** شرطُ التسجيل: الطالبُ مباشرةً، وما عداه عبر الإسناد */
const enrollmentScope = (query) => {
    const where = {};
    if (query.studentId)
        where.studentId = query.studentId;
    const assignment = (0, exports.teachingAssignmentScope)(query);
    if (hasKeys(assignment))
        where.teachingAssignment = assignment;
    return where;
};
exports.enrollmentScope = enrollmentScope;
// ======================================================
// الفواتير — زمنُها حقلا الأعمال
// ======================================================
const invoiceScope = (query, options = {}) => {
    const where = options.includeCancelled
        ? {}
        : { ...reporting_1.activeInvoice };
    /*
     * حالةٌ صريحة تتقدّم على الاستثناء الافتراضي.
     *
     * من فلتر على `CANCELLED` قصدها. وليس هذا خرقاً لـ§52: القاعدةُ
     * أنّ الملغى لا يدخل **المجاميع المالية**، لا أنّه لا يُعرض —
     * وشاشةُ الإلغاءات (§38) تُبنى على هذا المسار بعينه.
     */
    if (query.invoiceStatus)
        where.status = query.invoiceStatus;
    const { yearMonth } = (0, exports.resolvePeriod)(query);
    if (yearMonth) {
        where.month = yearMonth.month;
        where.year = yearMonth.year;
    }
    /*
     * السنةُ الدراسية على الفاتورة مباشرةً لا عبر الإسناد.
     *
     * الفاتورةُ تحمل `academicYearId` بنفسها، وقراءتُها منه أرخص —
     * وتتجنّب اشتراطاً على الإسناد يُسقط الفهرس.
     */
    if (query.academicYearId)
        where.academicYearId = query.academicYearId;
    const enrollment = (0, exports.enrollmentScope)({ ...query, academicYearId: undefined });
    if (hasKeys(enrollment))
        where.studentEnrollment = enrollment;
    return where;
};
exports.invoiceScope = invoiceScope;
/**
 * فواتيرُ الدَّين القديم — أقدمُ من فترة المرجع.
 *
 * الشرطُ على (سنة، شهر) لا على تاريخ: سنةٌ أقلّ، أو نفسُ السنة
 * وشهرٌ أقلّ. وكتابتُه على التواريخ كانت ستحتاج تحويلَ الحقلين
 * داخل الاستعلام فيسقط الفهرسُ على `[month, year]`.
 */
const oldDebtScope = (query, reference) => {
    const base = (0, exports.invoiceScope)({ ...query, month: undefined, year: undefined });
    return {
        ...base,
        remaining: { gt: 0 },
        OR: [
            { year: { lt: reference.year } },
            { year: reference.year, month: { lt: reference.month } },
        ],
    };
};
exports.oldDebtScope = oldDebtScope;
// ======================================================
// الدفعات — زمنُها لحظةُ الدفع
// ======================================================
const paymentScope = (query, options = {}) => {
    const where = options.includeCancelled
        ? {}
        : { ...reporting_1.activePayment };
    if (query.paymentStatus)
        where.status = query.paymentStatus;
    if (query.paymentMethod)
        where.paymentMethod = query.paymentMethod;
    const { range } = (0, exports.resolvePeriod)(query);
    /*
     * `paymentDate` لا `createdAt`.
     *
     * دفعةٌ استُلمت نقداً يوم الخميس وأُدخلت يوم السبت تنتمي إلى
     * الخميس. و`createdAt` تجيب سؤالَ التدقيق «متى أُدخل السجلّ»
     * وحده (§37).
     */
    if (range)
        where.paymentDate = { gte: range.from, lte: range.to };
    const enrollment = (0, exports.enrollmentScope)(query);
    /*
     * ربطُ الدفعة بالنطاق الأكاديمي يمرّ بالفواتير التي سدّدتها.
     *
     * و`some` لا `every`: الدفعةُ الواحدة قد تُوزَّع على فواتير
     * موادَّ مختلفة، فوجودُ فاتورةٍ واحدة داخل النطاق يُدخلها.
     * و`every` كانت ستُسقط كلَّ دفعةٍ عابرةٍ للمواد.
     *
     * وأثرٌ جانبيّ يجب أن يُعرف: مجموعُ الدفعات مفلترةً بمادّةٍ يشمل
     * **كاملَ** مبلغ الدفعة لا حصّةَ تلك المادة منه. ومن أراد
     * التوزيع الدقيق فمصدرُه `PaymentInvoice.paidAmount` — وهو ما
     * يفعله تقريرُ الفواتير، لا هذا.
     */
    if (hasKeys(enrollment)) {
        where.paymentInvoices = {
            some: { invoice: { studentEnrollment: enrollment } },
        };
    }
    return where;
};
exports.paymentScope = paymentScope;
// ======================================================
// الحضور — زمنُه يومُ الحصّة
// ======================================================
const attendanceScope = (query) => {
    const where = {};
    if (query.attendanceStatus)
        where.status = query.attendanceStatus;
    const { range } = (0, exports.resolvePeriod)(query);
    const session = {};
    /*
     * `session.sessionDate` لا `attendance.createdAt`.
     *
     * `createdAt` لحظةُ تسجيل الأستاذ للورقة، وقد تتأخّر أيّاماً عن
     * الحصّة. والحضورُ واقعةٌ في يوم الحصّة لا يوم تدوينها.
     */
    if (range)
        session.sessionDate = { gte: range.from, lte: range.to };
    /*
     * الأستاذُ والمادةُ والفوج عبر `schedule.teachingAssignment`:
     * الحصّةُ لا تحمل أستاذاً، بل جدولاً يشير إلى الإسناد.
     */
    const assignment = (0, exports.teachingAssignmentScope)(query);
    if (hasKeys(assignment)) {
        session.schedule = { teachingAssignment: assignment };
    }
    if (hasKeys(session))
        where.session = session;
    /*
     * الطالبُ عبر التسجيل. ولا يُضاف شرطُ الإسناد هنا مرّةً ثانية —
     * هو مطبَّقٌ على الحصّة سلفاً، وتكرارُه يضيف وصلةً بلا أثر.
     */
    if (query.studentId) {
        where.studentEnrollment = { studentId: query.studentId };
    }
    return where;
};
exports.attendanceScope = attendanceScope;
// ======================================================
// الحصص
// ======================================================
const sessionScope = (query) => {
    const where = {};
    const { range } = (0, exports.resolvePeriod)(query);
    if (range)
        where.sessionDate = { gte: range.from, lte: range.to };
    const assignment = (0, exports.teachingAssignmentScope)(query);
    if (hasKeys(assignment)) {
        where.schedule = { teachingAssignment: assignment };
    }
    return where;
};
exports.sessionScope = sessionScope;
// ======================================================
// التخليص — زمنُه فترةُ العمل
// ======================================================
const settlementScope = (query, options = {}) => {
    const where = options.includeCancelled
        ? {}
        : { ...reporting_1.activeSettlement };
    if (options.committedOnly)
        where.status = { in: ["CONFIRMED", "PAID"] };
    if (query.settlementStatus)
        where.status = query.settlementStatus;
    if (query.academicYearId)
        where.academicYearId = query.academicYearId;
    if (query.teacherId)
        where.teacherId = query.teacherId;
    const assignment = (0, exports.teachingAssignmentScope)({
        ...query,
        academicYearId: undefined,
        teacherId: undefined,
    });
    if (hasKeys(assignment))
        where.teachingAssignment = assignment;
    const { range } = (0, exports.resolvePeriod)(query);
    /*
     * §53: التخليصُ يُفلتر بفترة عمله لا بيوم حسابه.
     *
     * تخليصُ سبتمبر المحسوبُ في أكتوبر عملُ سبتمبر. و`computedAt`
     * تقول متى ضُغط زرُّ الحساب — سؤالُ تدقيقٍ لا سؤالُ تقرير.
     *
     * وفترةُ العمل تُقرأ من **حصص الكشف**: `AttendanceSheet` لا
     * تحمل شهراً ولا سنةً ولا تاريخَ بداية، تحمل `number` و
     * `createdAt` فقط. و`createdAt` تاريخُ إنشاء الكشف — قد يسبق
     * الحصص أو يليها. فالحصصُ هي وحدها ما يؤرّخ الكشفَ صدقاً.
     *
     * و`some`: يكفي أن تقع حصّةٌ واحدة في المدى ليدخل الكشف. كشفٌ
     * يمتدّ على شهرين يظهر في تقريرَي الشهرين — وهو الصواب، لأنّ
     * عملَه وقع فيهما.
     */
    if (range) {
        where.attendanceSheet = {
            sessions: { some: { sessionDate: { gte: range.from, lte: range.to } } },
        };
    }
    return where;
};
exports.settlementScope = settlementScope;
// ======================================================
// دفعات الأساتذة — زمنُها لحظةُ الدفع
// ======================================================
const teacherPaymentScope = (query, options = {}) => {
    const where = options.includeCancelled
        ? {}
        : { ...reporting_1.activeTeacherPayment };
    if (query.teacherId)
        where.teacherId = query.teacherId;
    if (query.paymentMethod)
        where.paymentMethod = query.paymentMethod;
    const { range } = (0, exports.resolvePeriod)(query);
    if (range)
        where.paymentDate = { gte: range.from, lte: range.to };
    return where;
};
exports.teacherPaymentScope = teacherPaymentScope;
//# sourceMappingURL=reports.scope.js.map