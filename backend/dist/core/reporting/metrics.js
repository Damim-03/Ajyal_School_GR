"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeAttendanceCounts = exports.countsFromGroupBy = exports.cashFlow = exports.allocationGap = exports.teacherFinancials = exports.attendance = exports.emptyAttendanceCounts = exports.debtAgeBucket = exports.debtAgeInMonths = exports.DEBT_AGE_BUCKETS = exports.debt = exports.cashCollected = exports.invoicing = void 0;
const money_1 = require("./money");
// ======================================================
// تعريفاتُ المؤشّرات — §65 و§66
//
// المؤشّرُ الواحد يُحسب في عشرين شاشة. وحين يُكتب في كلٍّ منها من
// جديد تتباعد التعريفات بصمت: شاشةٌ تحسب نسبةَ التحصيل من
// `invoice.remaining` وأخرى من مجموع الدفعات، فتعرض الشاشتان رقمين
// مختلفين لنفس الشهر — ولا يعرف أحدٌ أيُّهما الصحيح.
//
// فكلُّ مؤشّرٍ هنا دالّةٌ نقيّة واحدة: تأخذ أعداداً مجمّعةً سلفاً
// من قاعدة البيانات وتُرجع الرقم. لا تلمس Prisma ولا الشبكة، فهي
// قابلةٌ للاختبار بلا قاعدة بيانات — وهذا شرطُ اختبارِ الحالات
// الحديّة في §74 قبل أن توجد بياناتٌ أصلاً.
// ======================================================
// ======================================================
// المالية — جانب الطالب
// ======================================================
/**
 * الحضورُ المالي لفترة: كم فُوتر، وكم حُصِّل، وكم بقي.
 *
 * `collected = invoiced - remaining` لا مجموعُ الدفعات.
 *
 * الفرقُ جوهري: دفعةٌ في نوفمبر تسدّد فاتورةَ سبتمبر تدخل في
 * «محصَّل سبتمبر» بهذا التعريف، وفي «محصَّل نوفمبر» بالتعريف
 * الآخر. وكلاهما سؤالٌ مشروع، لكنّهما سؤالان مختلفان:
 *
 *   - هذا التعريف يجيب: **كم استوفينا من استحقاق سبتمبر؟**
 *   - مجموعُ الدفعات يجيب: **كم دخل الصندوق في نوفمبر؟**
 *
 * الأوّل لنسبة التحصيل، والثاني للتدفّق النقدي (§33) — ولذلك
 * `cashCollected` دالّةٌ منفصلة أدناه، لا تسميةٌ أخرى لنفس الرقم.
 *
 * وهذا التعريف هو المعمول به في `report.service.ts` الحالي، فلم
 * أُغيّره: تغييرُ تعريفٍ قائم يُنتج قفزةً في الأرقام التاريخية بلا
 * تغيّرٍ في الواقع.
 */
const invoicing = (input) => {
    const invoiced = (0, money_1.toDecimal)(input.invoicedTotal);
    const remaining = (0, money_1.toDecimal)(input.remainingTotal);
    const collected = invoiced.minus(remaining);
    return {
        invoiced: (0, money_1.toNumber)(invoiced),
        collected: (0, money_1.toNumber)(collected),
        /** المتبقّي = المستحقّ غير المسدَّد. هو نفسه الدَّين (§25) */
        outstanding: (0, money_1.toNumber)(remaining),
        discounts: (0, money_1.toNumber)(input.discountTotal ?? 0),
        invoiceCount: input.invoiceCount ?? 0,
        /** §66: المحصَّل النشط ÷ المفوتر النشط */
        collectionRate: (0, money_1.rate)(collected, invoiced),
    };
};
exports.invoicing = invoicing;
/**
 * النقدُ الداخل فعلاً في الفترة — أساسُ §33.
 *
 * مجموعُ الدفعات النشطة بتاريخ الدفع، بصرف النظر عن الشهر الذي
 * تسدّده. يشمل تحصيلَ الديون القديمة لأنّ الدينار يدخل الصندوق
 * اليوم وإن كان استحقاقُه من سبتمبر.
 */
const cashCollected = (input) => {
    const total = (0, money_1.toDecimal)(input.paymentTotal);
    const count = input.paymentCount ?? 0;
    return {
        total: (0, money_1.toNumber)(total),
        count,
        /**
         * متوسّطُ الدفعة — `null` لا صفر حين لا دفعات.
         * «متوسّط 0 دج» يوحي بدفعاتٍ قيمتُها صفر، والواقعُ لا دفعات.
         */
        average: count > 0 ? (0, money_1.toNumber)(total.dividedBy(count)) : null,
    };
};
exports.cashCollected = cashCollected;
// ======================================================
// الديون — §25
// ======================================================
/**
 * الدَّين مقسوماً بحسب فترته الأصلية لا بحسب اليوم.
 *
 * «قديم» و«جارٍ» يُحدَّدان بشهر الفاتورة وسنتها (`invoice.month`
 * و`invoice.year`)، لا بـ`createdAt` — §58. فاتورةُ سبتمبر
 * المُدخَلة متأخّرةً في أكتوبر دَينُها سبتمبريّ.
 */
const debt = (input) => {
    const current = (0, money_1.toDecimal)(input.currentRemaining);
    const previous = (0, money_1.toDecimal)(input.previousRemaining);
    return {
        total: (0, money_1.toNumber)(current.plus(previous)),
        current: (0, money_1.toNumber)(current),
        /** الدَّين القديم: نشأ في فترةٍ سابقة ولم يُسدَّد بعد */
        old: (0, money_1.toNumber)(previous),
        studentsInDebt: input.studentsInDebt ?? 0,
        collectedOld: (0, money_1.toNumber)(input.collectedOld ?? 0),
        /**
         * نسبةُ استرداد الدَّين القديم.
         *
         * المقام = القديمُ المتبقّي + المحصَّل منه، أي حجمُ الدَّين
         * القديم قبل التحصيل. وقسمتُه على المتبقّي وحده تُنتج نسبةً
         * تتجاوز 100% كلّما حُصِّل أكثر ممّا بقي.
         */
        oldRecoveryRate: (0, money_1.rate)(input.collectedOld ?? 0, previous.plus((0, money_1.toDecimal)(input.collectedOld ?? 0))),
    };
};
exports.debt = debt;
/**
 * تعتيقُ الدَّين — §25.
 *
 * الشرائح بالأشهر منذ الفترة الأصلية. الحدودُ ثابتةٌ هنا عمداً
 * لأنّها اصطلاحٌ محاسبي شائع (30/60/90)، لا عتبةُ تنبيهٍ تخصّ
 * المؤسسة — وتلك وحدها ما يجب أن يكون قابلاً للتهيئة (§7).
 */
exports.DEBT_AGE_BUCKETS = [
    { key: "current", label: "الشهر الجاري", minMonths: 0, maxMonths: 0 },
    { key: "d30", label: "شهر واحد", minMonths: 1, maxMonths: 1 },
    { key: "d60", label: "شهران", minMonths: 2, maxMonths: 2 },
    { key: "d90", label: "ثلاثة أشهر", minMonths: 3, maxMonths: 3 },
    { key: "older", label: "أكثر من ثلاثة أشهر", minMonths: 4, maxMonths: null },
];
/**
 * عمرُ الدَّين بالأشهر بين فترة الفاتورة وفترة المرجع.
 *
 * الحسابُ على (سنة، شهر) لا على تواريخ: الفاتورة تحمل الشهرَ
 * والسنةَ حقلَي أعمال (§58)، واشتقاقُ الفارق من التواريخ يُدخل
 * أخطاءَ اليوم والمنطقة الزمنية بلا فائدة.
 */
const debtAgeInMonths = (invoice, reference) => (reference.year - invoice.year) * 12 + (reference.month - invoice.month);
exports.debtAgeInMonths = debtAgeInMonths;
const debtAgeBucket = (ageInMonths) => {
    const age = Math.max(0, ageInMonths);
    for (const bucket of exports.DEBT_AGE_BUCKETS) {
        if (bucket.maxMonths === null)
            return bucket.key;
        if (age >= bucket.minMonths && age <= bucket.maxMonths)
            return bucket.key;
    }
    return "older";
};
exports.debtAgeBucket = debtAgeBucket;
const emptyAttendanceCounts = () => ({
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    EXCUSED: 0,
});
exports.emptyAttendanceCounts = emptyAttendanceCounts;
/**
 * نسبةُ الحضور.
 *
 * **المتأخّر يُحتسب حاضراً** — وهذا ما يفعله النظام اليوم في
 * `report.service.ts`، وهو الصواب مؤسسياً: الطالبُ المتأخّر حضر
 * الحصّة وتلقّى الدرس، وتأخّرُه مسألةُ انضباطٍ تُقاس بـ`lateRate`
 * على حدة.
 *
 * **والمعذورُ يبقى في المقام.** حذفُه يجعل فوجاً نصفُه بأعذار
 * يظهر بحضورٍ 100% — ووظيفةُ المؤشّر أن يكشف الفجوة لا أن
 * يُجمّلها. ومن أراد النسبةَ بلا أعذار فله `attendanceRateExcused`
 * أدناه، صريحاً باسمه.
 */
const attendance = (counts) => {
    const total = counts.PRESENT + counts.ABSENT + counts.LATE + counts.EXCUSED;
    const attended = counts.PRESENT + counts.LATE;
    return {
        counts,
        total,
        attended,
        /** §66: الحاضر (شاملاً المتأخّر) ÷ كلّ السجلّات المؤهَّلة */
        attendanceRate: (0, money_1.rate)(attended, total),
        absenceRate: (0, money_1.rate)(counts.ABSENT, total),
        lateRate: (0, money_1.rate)(counts.LATE, total),
        excusedRate: (0, money_1.rate)(counts.EXCUSED, total),
        /**
         * النسبةُ بعد استبعاد المعذورين من المقام — لقياس الانضباط
         * وحده. تُعرض بجانب الأولى لا بدلاً منها.
         */
        attendanceRateExcused: (0, money_1.rate)(attended, total - counts.EXCUSED),
    };
};
exports.attendance = attendance;
// ======================================================
// المالية — جانب الأستاذ (§27 و§29 و§31)
//
// منفصلةٌ تماماً عن جانب الطالب — §52.5. الدالّتان لا تتقاطعان،
// وأيُّ مجموعٍ يضمّ الجانبين معاً خطأٌ في التعريف لا في الحساب.
// ======================================================
/**
 * مستحقُّ الأستاذ وما دُفع منه.
 *
 * الاستحقاقُ من مصدرين لا مصدرٍ واحد:
 *   1. `settlement.teacherAmount` — تخليصُ فتراتٍ درّسها
 *   2. `teacherDebtShare.shareAmount` — حصّتُه من دَينٍ قديم
 *      حُصِّل بعد فترته (§26 و§52.8)
 *
 * وإغفالُ الثاني يُنقص مستحقَّ كلِّ أستاذٍ درّس فترةً لم تُحصَّل
 * ديونُها إلا لاحقاً — وهو الحال الغالب في المؤسسات التعليمية.
 *
 * والمدفوعُ من `TeacherPaymentAllocation` لا من `TeacherPayment`
 * مباشرةً: الدفعةُ الواحدة تُوزَّع على تخليصٍ وحصصِ دَين (§32)،
 * والمجموعُ الخام لا يقول أين ذهب كلُّ دينار.
 */
const teacherFinancials = (input) => {
    const entitlement = (0, money_1.sum)([
        input.settlementEntitlement,
        input.debtShareEntitlement ?? 0,
    ]);
    const paid = (0, money_1.toDecimal)(input.allocatedPaid);
    return {
        entitlement: (0, money_1.toNumber)(entitlement),
        fromSettlements: (0, money_1.toNumber)(input.settlementEntitlement),
        fromDebtShares: (0, money_1.toNumber)(input.debtShareEntitlement ?? 0),
        paid: (0, money_1.toNumber)(paid),
        /** §66: المستحقُّ النشط − المدفوعُ المخصَّص النشط */
        outstanding: (0, money_1.toNumber)((0, money_1.subtract)(entitlement, paid)),
        paidRate: (0, money_1.rate)(paid, entitlement),
    };
};
exports.teacherFinancials = teacherFinancials;
/**
 * دفعةٌ غير مخصَّصة — مؤشّرُ جودةِ بيانات (§39).
 *
 * مجموعُ الدفعة يجب أن يساوي مجموعَ تخصيصاتها. والفرقُ يعني
 * ديناراً دُفع للأستاذ ولا يُعرف مقابلَ أيِّ استحقاق — وهو بالضبط
 * ما تمنعه §32.
 */
const allocationGap = (input) => {
    const gap = (0, money_1.subtract)(input.paymentAmount, input.allocatedAmount);
    return {
        paid: (0, money_1.toNumber)(input.paymentAmount),
        allocated: (0, money_1.toNumber)(input.allocatedAmount),
        unallocated: (0, money_1.toNumber)(gap),
        isBalanced: (0, money_1.toDecimal)(gap).isZero(),
    };
};
exports.allocationGap = allocationGap;
// ======================================================
// التدفّق النقدي — §33
// ======================================================
/**
 * حركةُ النقد لا «الربح».
 *
 * §33 صريحٌ في هذا ولوجهٍ سليم: النظام لا يعرف الإيجارَ ولا
 * الكهرباءَ ولا الرواتبَ الإدارية. فتسميةُ الفرق «ربحاً» تُنتج
 * رقماً تتّخذ الإدارةُ عليه قراراً وهو يتجاهل نصفَ المصاريف.
 *
 * `netMovement` = ما دخل − ما خرج. لا أكثر، والاسمُ يقول ذلك.
 */
const cashFlow = (input) => {
    /*
     * `debtCollections` **ليست** إضافةً على `studentPayments`.
     *
     * تحصيلُ الدَّين واقعةٌ مشتقّة من دفعةٍ موجودة سلفاً في
     * `studentPayments`، فجمعُهما يحتسب الدينارَ مرّتين. تُعرض هنا
     * للتفصيل وحده: «من أصل ما دخل، هذا القدر كان ديوناً قديمة».
     */
    const moneyIn = (0, money_1.toDecimal)(input.studentPayments);
    const moneyOut = (0, money_1.toDecimal)(input.teacherPayments);
    return {
        moneyIn: (0, money_1.toNumber)(moneyIn),
        moneyOut: (0, money_1.toNumber)(moneyOut),
        ofWhichDebtCollection: (0, money_1.toNumber)(input.debtCollections ?? 0),
        netMovement: (0, money_1.toNumber)(moneyIn.minus(moneyOut)),
        /** نسبةُ ما خرج للأساتذة من الوارد */
        teacherCostRatio: (0, money_1.rate)(moneyOut, moneyIn),
    };
};
exports.cashFlow = cashFlow;
// ======================================================
// أدوات
// ======================================================
/**
 * تحويلُ نتيجة `groupBy` على الحالة إلى عدّادٍ كامل.
 *
 * Prisma لا تُرجع صفّاً للحالة التي لا يطابقها سجلّ، فالفوجُ الذي
 * لا غياب فيه يعود بلا مفتاح `ABSENT` — والقراءةُ المباشرة تُنتج
 * `undefined` يتسرّب إلى الجمع فيصير `NaN`.
 */
const countsFromGroupBy = (rows) => {
    const counts = (0, exports.emptyAttendanceCounts)();
    for (const row of rows)
        counts[row.status] = row._count;
    return counts;
};
exports.countsFromGroupBy = countsFromGroupBy;
/** جمعُ عدّادات حضورٍ من عدّة مصادر */
const mergeAttendanceCounts = (parts) => parts.reduce((total, part) => {
    total.PRESENT += part.PRESENT;
    total.ABSENT += part.ABSENT;
    total.LATE += part.LATE;
    total.EXCUSED += part.EXCUSED;
    return total;
}, (0, exports.emptyAttendanceCounts)());
exports.mergeAttendanceCounts = mergeAttendanceCounts;
//# sourceMappingURL=metrics.js.map