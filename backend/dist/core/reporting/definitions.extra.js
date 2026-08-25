"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTRA_METRIC_DEFINITIONS = void 0;
// ======================================================
// تتمّةُ كتالوج المؤشّرات — §66
//
// الكتالوجُ الأوّل غطّى خمسةَ عشرَ مؤشّراً هي أهمُّ ما يُقرأ. ثمّ
// أُضيفت التقاريرُ الستّةَ عشرَ فبلغ المستعمَلُ خمسةً وسبعين — وبقي
// ستّون بلا تعريف.
//
// وأثرُ النقص لم يظهر في الاختبارات لأنّ `metric()` تسقط إلى
// المفتاح عند غياب التعريف فلا ترمي. وإنّما ظهر في أوّل ملفِّ
// تصديرٍ حقيقي: صفوفُ المؤشّرات مكتوبةٌ `totalStudents` و
// `activeStudents` في ورقةٍ عربية.
//
// وهذا هو الفرقُ بين «يعمل» و«يُقرأ»: التقريرُ الذي يُصدَّر يُرسَل
// إلى من لم يفتح النظام قطّ، ومفتاحٌ إنجليزيّ في ورقةِ Excel لا
// يقول له شيئاً.
//
// وفُصلت في ملفٍّ ثانٍ لا لأنّها أدنى مرتبة، بل لأنّ ملفاً بخمسةٍ
// وسبعين تعريفاً لا يُقرأ دفعةً واحدة — والأوّلُ يبقى مدخلاً
// للمؤشّرات التي تُقرأ كلَّ يوم.
// ======================================================
const m = (key, domain, label, unit, direction, formula, description, extra = {}) => ({
    key,
    domain,
    label,
    unit,
    direction,
    formula,
    description,
    ...extra,
});
exports.EXTRA_METRIC_DEFINITIONS = [
    // --------------------------------------------------
    // الطلبة — §8
    // --------------------------------------------------
    m("totalStudents", "students", "إجمالي الطلبة", "count", "neutral", "COUNT(Student) داخل نطاق الفلاتر", "عدد الطلبة الذين لهم تسجيل واحد على الأقلّ داخل النطاق المختار.", { drillTo: "/reports/students" }),
    m("activeStudents", "students", "الطلبة النشطون", "count", "higherIsBetter", "COUNT(Student) WHERE isActive = true", "الطلبة الذين ما زالوا على رأس الدراسة."),
    m("inactiveStudents", "students", "الطلبة غير النشطين", "count", "neutral", "totalStudents - activeStudents", "من غادروا أو أُوقف تسجيلهم."),
    m("activeRate", "students", "نسبة النشطين", "percent", "higherIsBetter", "activeStudents / totalStudents × 100", "أيّ نسبة من الطلبة ما زالت على رأس الدراسة.", { caveat: "غير محسوبة حين لا طلبة في النطاق." }),
    m("studentsInDebt", "debt", "الطلبة المدينون", "count", "lowerIsBetter", "COUNT(DISTINCT Student) WHERE أيّ فاتورة remaining > 0", "عدد الأشخاص لا عدد الفواتير.", {
        caveat: "طالب عليه خمس فواتير مدين واحد لا خمسة — العدّ على الطالب لا على الفاتورة.",
        drillTo: "/reports/debts",
    }),
    m("studentsAcrossBuckets", "academic", "مجموع الطلبة عبر الفئات", "count", "neutral", "SUM(students) لكل فئة في البُعد", "مجموع أعداد الطلبة في فئات هذا البُعد.", {
        caveat: "قد يفوق عدد طلبة المؤسسة: طالب في موادّ من مستويين يُعدّ في كليهما. ليس عدداً للأشخاص.",
    }),
    // --------------------------------------------------
    // الحضور — §18
    // --------------------------------------------------
    m("lateRate", "attendance", "نسبة التأخّر", "percent", "lowerIsBetter", "LATE / كل السجلّات × 100", "مقياس انضباط لا غياب — المتأخّر حضر وتلقّى الدرس."),
    m("excusedRate", "attendance", "نسبة الأعذار", "percent", "neutral", "EXCUSED / كل السجلّات × 100", "الغياب المعذور. ارتفاعه ليس سوءاً بذاته لكنه يستحقّ النظر."),
    m("attendanceRecords", "attendance", "سجلّات الحضور", "count", "neutral", "COUNT(Attendance) داخل النطاق", "حجم العيّنة التي حُسبت عليها النسب.", {
        caveat: "صفر يعني أن النسب غير محسوبة — لا أنّ الحضور صفر.",
    }),
    // --------------------------------------------------
    // الحصص — §17
    // --------------------------------------------------
    m("sessionCount", "academic", "عدد الحصص", "count", "neutral", "COUNT(Session) داخل النطاق", "كل الحصص أيّاً كانت حالتها.", { drillTo: "/reports/sessions" }),
    m("scheduledSessions", "academic", "حصص مجدولة", "count", "neutral", "COUNT(Session) WHERE status = SCHEDULED", "حصص لم تقع بعد."),
    m("completedSessions", "academic", "حصص مكتملة", "count", "higherIsBetter", "COUNT(Session) WHERE status = COMPLETED", "حصص وقعت فعلاً."),
    m("cancelledSessions", "academic", "حصص ملغاة", "count", "lowerIsBetter", "COUNT(Session) WHERE status = CANCELLED", "حصص أُلغيت ولم تُدرَّس."),
    m("sessionsWithAttendance", "academic", "حصص بحضور مسجَّل", "count", "higherIsBetter", "COUNT(Session) WHERE يوجد سجلّ حضور واحد على الأقلّ", "حصص مُلئت ورقة حضورها."),
    m("sessionsWithoutAttendance", "academic", "حصص بلا حضور مسجَّل", "count", "lowerIsBetter", "COUNT(Session) WHERE لا سجلّ حضور", "ورقة لم تُملأ. التخليص يُحسب على الحضور، فالنقص هنا ينقص مستحقّ الأستاذ.", {
        caveat: "وجود الحصّة لا يساوي تسجيل حضورها — §17.",
        drillTo: "/reports/data-quality",
    }),
    // --------------------------------------------------
    // المالية — الطالب
    // --------------------------------------------------
    m("paymentCount", "financial", "عدد الدفعات", "count", "neutral", "COUNT(Payment) WHERE status = ACTIVE", "عدد الدفعات النشطة في الفترة.", { exclusions: "الملغاة لا تدخل (§52.1)." }),
    m("cancelledInvoices", "financial", "فواتير ملغاة", "count", "lowerIsBetter", "COUNT(Invoice) WHERE status = CANCELLED", "تُعرض عدداً ولا تدخل أيّ مجموع مالي.", {
        caveat: "إخفاؤها يمنع ملاحظة إلغاء غير معتاد، وإدخالها في المجاميع يكذب. فالعدّ وحده (§21).",
        drillTo: "/reports/cancellations",
    }),
    m("cancelledPayments", "financial", "دفعات ملغاة", "count", "lowerIsBetter", "COUNT(Payment) WHERE status = CANCELLED", "دفعات أُلغيت — خارج المجاميع، داخل التدقيق.", { drillTo: "/reports/cancellations" }),
    // --------------------------------------------------
    // الديون — §25
    // --------------------------------------------------
    m("debtCurrent", "debt", "الدَّين الجاري", "money", "lowerIsBetter", "debtTotal - debtOld", "متبقّي فواتير الفترة المعروضة نفسها.", {
        caveat: "يُشتقّ طرحاً لا باستعلام ثانٍ، ليبقى المجموع مساوياً لجمع جزأيه دائماً.",
    }),
    m("oldRecoveryRate", "debt", "نسبة استرداد الدَّين القديم", "percent", "higherIsBetter", "collectedOld / (debtOld + collectedOld) × 100", "أيّ نسبة من الدَّين القديم استُرِدّت.", {
        caveat: "المقام حجم الدَّين قبل التحصيل. وقسمتها على المتبقّي وحده تتجاوز 100% متى حُصِّل أكثر ممّا بقي.",
    }),
    m("collectionCount", "debt", "عدد عمليات التحصيل", "count", "higherIsBetter", "COUNT(DebtCollection) WHERE Payment.status = ACTIVE", "عدد المرّات التي استُرِدّ فيها دَين قديم.", { drillTo: "/reports/debt-collections" }),
    m("teacherSharesOnPage", "teacher", "حصص الأساتذة (هذه الصفحة)", "money", "neutral", "SUM(teacherShareAmount) لصفوف الصفحة المعروضة", "مجموع حصص الأساتذة من التحصيلات المعروضة.", {
        caveat: "من الصفحة لا من الفترة كلّها. الاسم يقول ذلك لئلّا يُقرأ مجموعاً لفترة.",
    }),
    // --------------------------------------------------
    // الإيصالات — §24
    // --------------------------------------------------
    m("totalReceipts", "financial", "إجمالي الإيصالات", "count", "neutral", "COUNT(Receipt) داخل النطاق", "كل الإيصالات أيّاً كانت حالتها.", { drillTo: "/reports/receipts" }),
    m("activeReceipts", "financial", "إيصالات نشطة", "count", "neutral", "COUNT(Receipt) WHERE status = ACTIVE", "إيصالات سارية."),
    m("cancelledReceipts", "financial", "إيصالات ملغاة", "count", "lowerIsBetter", "COUNT(Receipt) WHERE status = CANCELLED", "تبقى في التدقيق ولا تُحذف (§24)."),
    m("reprintedReceipts", "financial", "إيصالات أُعيد طبعها", "count", "neutral", "COUNT(Receipt) WHERE status = REPRINTED", "إعادة الطبع واقعة تُسجَّل لا تُخفى."),
    m("printedReceipts", "financial", "إيصالات مطبوعة", "count", "neutral", "COUNT(Receipt) WHERE printed = true", "ما سُلّم للطلبة فعلاً."),
    m("notPrintedReceipts", "financial", "إيصالات غير مطبوعة", "count", "lowerIsBetter", "totalReceipts - printedReceipts", "إيصالات أُنشئت ولم تُسلَّم بعد."),
    // --------------------------------------------------
    // التخليص — §29
    // --------------------------------------------------
    m("totalSettlements", "settlement", "إجمالي التخليصات", "count", "neutral", "COUNT(Settlement) داخل النطاق", "كل التخليصات أيّاً كانت حالتها.", { drillTo: "/reports/settlements" }),
    m("draftSettlements", "settlement", "تخليصات مسوّدة", "count", "neutral", "COUNT(Settlement) WHERE status = DRAFT", "حُسبت ولم تُعتمد بعد."),
    m("confirmedSettlements", "settlement", "تخليصات مؤكَّدة", "count", "neutral", "COUNT(Settlement) WHERE status = CONFIRMED", "اعتُمدت فصارت واجبة الدفع، ولا يُعاد حسابها (§53)."),
    m("paidSettlements", "settlement", "تخليصات مدفوعة", "count", "higherIsBetter", "COUNT(Settlement) WHERE status = PAID", "استوفى الأستاذ مستحقّه منها."),
    m("cancelledSettlements", "settlement", "تخليصات ملغاة", "count", "lowerIsBetter", "COUNT(Settlement) WHERE status = CANCELLED", "التصحيح يتمّ بالإلغاء والاستبدال لا بتعديل السجلّ (§52.12).", { drillTo: "/reports/cancellations" }),
    m("committedEntitlement", "settlement", "المستحقّ الملتزَم به", "money", "neutral", "SUM(teacherAmount) WHERE status IN (CONFIRMED, PAID)", "ما التزمت به المؤسسة فعلاً تجاه الأساتذة.", {
        caveat: "المسوّدة خارجه: حساب لم يُعتمد، وإدخاله يُظهر ديناً وهمياً على المؤسسة.",
    }),
    m("draftEntitlement", "settlement", "مستحقّ المسوّدات", "money", "neutral", "SUM(teacherAmount) WHERE status = DRAFT", "محسوب ولم يُعتمد — يُعرض منفصلاً ليُرى دون أن يُخلط بالالتزام."),
    m("teacherFromSettlements", "teacher", "المستحقّ من التخليص", "money", "neutral", "SUM(Settlement.teacherAmount) WHERE status != CANCELLED", "الشقّ الأوّل من مستحقّ الأستاذ: عمل فتراته."),
    m("teacherFromDebtShares", "teacher", "المستحقّ من حصص الدَّين", "money", "neutral", "SUM(TeacherDebtShare.shareAmount) WHERE status != CANCELLED", "الشقّ الثاني: حصّته من ديون حُصِّلت بعد فترته (§26).", {
        caveat: "إغفاله يُنقص مستحقّ كل أستاذ درّس فترة لم تُحصَّل ديونها إلا لاحقاً — وهو الحال الغالب.",
    }),
    // --------------------------------------------------
    // دفعات الأساتذة — §31 §32
    // --------------------------------------------------
    m("teacherPaymentCount", "teacher", "عدد دفعات الأساتذة", "count", "neutral", "COUNT(TeacherPayment) WHERE status = ACTIVE", "عدد الدفعات الصادرة للأساتذة.", { drillTo: "/reports/teacher-payments" }),
    m("averageTeacherPayment", "teacher", "متوسّط دفعة الأستاذ", "money", "neutral", "teacherPaid / teacherPaymentCount", "متوسّط قيمة الدفعة الواحدة.", { caveat: "غير محسوب حين لا دفعات — لا صفر." }),
    m("cancelledTeacherPayments", "teacher", "دفعات أساتذة ملغاة", "count", "lowerIsBetter", "COUNT(TeacherPayment) WHERE status = CANCELLED", "خارج المجاميع، داخل التدقيق (§52.3).", { drillTo: "/reports/cancellations" }),
    m("allocationCount", "teacher", "عدد التخصيصات", "count", "neutral", "COUNT(TeacherPaymentAllocation) داخل النطاق", "عدد الأجزاء التي وُزّعت عليها دفعات الأساتذة.", { drillTo: "/reports/allocations" }),
    m("allocatedToSettlements", "teacher", "المخصَّص للتخليص", "money", "neutral", "SUM(allocation.amount) WHERE settlementId IS NOT NULL", "ما ذهب من دفعات الأساتذة إلى تخليصات فترات."),
    m("allocatedToDebtShares", "teacher", "المخصَّص لحصص الدَّين", "money", "neutral", "SUM(allocation.amount) WHERE teacherDebtShareId IS NOT NULL", "ما ذهب إلى حصص الأساتذة من ديون محصَّلة."),
    m("orphanAllocations", "teacher", "تخصيصات بلا وجهة", "count", "lowerIsBetter", "COUNT(allocation) WHERE لا تخليص ولا حصّة دَين", "تخصيص لا يشير إلى شيء — حالة لا ينبغي أن تقع.", {
        caveat: "ظهورها خلل في البيانات يُعرض ليُعالَج لا ليُخفى (§39).",
        drillTo: "/reports/data-quality",
    }),
    // --------------------------------------------------
    // التدفّق النقدي — §33
    // --------------------------------------------------
    m("moneyIn", "cashflow", "الوارد", "money", "higherIsBetter", "SUM(Payment.amount) WHERE status = ACTIVE", "ما دخل الصندوق في الفترة بتاريخ الدفع."),
    m("moneyOut", "cashflow", "الصادر", "money", "neutral", "SUM(TeacherPayment.amount) WHERE status = ACTIVE", "ما خرج للأساتذة في الفترة.", { caveat: "لا يشمل مصاريف أخرى — النظام لا يعرفها." }),
    m("ofWhichDebtCollection", "cashflow", "منه: تحصيل ديون قديمة", "money", "higherIsBetter", "SUM(DebtCollection.collectedAmount) النشط", "الجزء من الوارد الذي كان استرداداً لديون سابقة.", {
        caveat: "تفصيل داخل الوارد لا زيادة عليه — جمعهما يحتسب الدينار مرّتين.",
    }),
    m("teacherCostRatio", "cashflow", "نسبة كلفة الأساتذة", "percent", "neutral", "moneyOut / moneyIn × 100", "أيّ نسبة من الوارد ذهبت للأساتذة.", { caveat: "غير محسوبة حين لا وارد." }),
    // --------------------------------------------------
    // التدقيق — §37
    // --------------------------------------------------
    m("auditEntries", "financial", "وقائع التدقيق", "count", "neutral", "COUNT(FinancialAuditLog) داخل الفترة", "عدد التغييرات المالية المسجَّلة.", { drillTo: "/reports/audit" }),
    m("auditCreates", "financial", "إنشاء", "count", "neutral", "COUNT WHERE action = CREATE", "سجلّات أُنشئت."),
    m("auditUpdates", "financial", "تعديل", "count", "neutral", "COUNT WHERE action = UPDATE", "قيم عُدّلت — أهمّ ما يُراجَع."),
    m("auditCancels", "financial", "إلغاء", "count", "neutral", "COUNT WHERE action = CANCEL", "عمليات أُلغيت."),
    m("auditConfirms", "financial", "تأكيد", "count", "neutral", "COUNT WHERE action = CONFIRM", "تخليصات اعتُمدت."),
    m("auditRecomputes", "financial", "إعادة حساب", "count", "neutral", "COUNT WHERE action = RECOMPUTE", "مسوّدات أُعيد حسابها."),
    // --------------------------------------------------
    // الإلغاءات وجودة البيانات — §38 §39
    // --------------------------------------------------
    m("cancellationCount", "financial", "عدد الإلغاءات", "count", "lowerIsBetter", "مجموع الملغى من فواتير ودفعات وإيصالات وتخليصات ودفعات أساتذة", "كل ما أُلغي في الفترة عبر الكيانات الخمسة.", { drillTo: "/reports/cancellations" }),
    m("cancelledAmountOnPage", "financial", "مبلغ الإلغاءات (هذه الصفحة)", "money", "lowerIsBetter", "SUM(amount) لصفوف الصفحة المعروضة", "مجموع مبالغ الإلغاءات المعروضة.", { caveat: "من الصفحة لا من الفترة كلّها." }),
    m("checksRun", "financial", "الفحوص المنفَّذة", "count", "neutral", "عدد فحوص جودة البيانات", "كم فحصاً أُجري — بما فيها ما لم يجد شيئاً.", {
        caveat: "الأصفار تُعرض عمداً: «فُحص ولم يُوجد» يطمئن، بخلاف غياب السطر الذي يُقرأ «لم يُفحص».",
    }),
    m("criticalIssues", "financial", "مشاكل حرجة", "count", "lowerIsBetter", "COUNT(فحص) WHERE severity = critical AND count > 0", "خلل يمسّ صحّة الأرقام ويستحقّ معالجة فورية.", { drillTo: "/reports/data-quality" }),
    m("warningIssues", "financial", "تنبيهات", "count", "lowerIsBetter", "COUNT(فحص) WHERE severity = warning AND count > 0", "خلل يستحقّ النظر ولا يُبطل الأرقام."),
    m("affectedRecords", "financial", "السجلّات المعنيّة", "count", "lowerIsBetter", "SUM(count) لكل الفحوص", "مجموع السجلّات التي رصدتها الفحوص."),
];
//# sourceMappingURL=definitions.extra.js.map