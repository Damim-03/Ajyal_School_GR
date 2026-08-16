import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ClipboardCheck,
  Eraser,
  FilePlus2,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  UserX,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { DateField, todayIso } from "../../components/DateField";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { SheetPreview } from "../../components/print/SheetPreview";
import { useAcademicYears } from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import {
  bulkAttendance,
  clearSessionAttendance,
  createAttendance,
  createSession,
  createSheet,
  deleteSheet,
  deriveOptions,
  fullName,
  getSheet,
  isoDate,
  listAssignments,
  listAttendance,
  listEnrollments,
  listSchedulesOf,
  listSheets,
  removeSession,
  resolveAssignment,
  sheetDate,
  sheetTitle,
  updateAttendance,
  adoptSession,
  findSessionsOn,
  updateSessionDate,
  updateSheet,
  updateStudentNote,
  STATUS_TONE,
  type Assignment,
  type AttendanceRow,
  type AttendanceStatus,
  type EnrollmentRow,
  type ScheduleOption,
  type Sheet,
  type SheetSession,
  type SessionRow,
  type SheetFilters,
} from "./attendance.api";
import {
  FEE_LABEL,
  FEE_TONE,
  feeStateOf,
  heldSessions,
  invoicePeriodOf,
  isAttended,
  type FeeState,
} from "./fees";
import { listInvoices, money, type Invoice } from "../finance/finance.api";

const ACCENT = "#fcd34d";

const cellKey = (enrollmentId: string, sessionId: string) => `${enrollmentId}|${sessionId}`;

/** تاريخ اليوم بتوقيت الجهاز — لا UTC: بعد الحادية عشرة ليلاً يختلفان يوماً */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY_FILTERS: SheetFilters = {
  stageId: "",
  levelId: "",
  subjectId: "",
  teacherId: "",
  groupId: "",
};

const FILTER_ORDER: (keyof SheetFilters)[] = [
  "stageId",
  "levelId",
  "subjectId",
  "teacherId",
  "groupId",
];

const matchesAll = (a: Assignment, f: SheetFilters) =>
  (!f.stageId || a.studyGroup.level.educationStage.id === f.stageId) &&
  (!f.levelId || a.studyGroup.level.id === f.levelId) &&
  (!f.subjectId || a.subject.id === f.subjectId) &&
  (!f.teacherId || a.teacher.id === f.teacherId) &&
  (!f.groupId || a.studyGroup.id === f.groupId);

/**
 * كشف الحضور اليومي.
 *
 * الكشف **وحدةٌ إدارية لا مدىً تقويمي**. كان يُشتقّ من شهرٍ ثم ما امتدّ
 * إليه، فكان يورث سؤالاً بلا جواب: حصةٌ في مطلع الشهر التالي — ذيلُ هذا
 * الكشف أم مطلعُ الذي يليه؟ السؤال ليس تقويمياً فلا جواب له في التقويم.
 *
 * فصار الكشف يملك أعمدته: تُنشئه، فيفتح لك أعمدةً بعدد ما قرّرته
 * المؤسسة، وتكتب في كل عمود تاريخه. والعمود في هذا الكشف لأنّ أحداً
 * وضعه فيه — لا لأنّ تاريخه وقع في نافذة.
 *
 * والمجموع محسوبٌ لا مخزَّن، والأعمدة تُرتَّب بالتاريخ كما تُقرأ الورقة.
 */
export default function DailySheetPage() {
  const exitTo = useScreenExit();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.hasPermission);
  const schoolName = useSchool("school.name_ar");

  /* الانتقاء على settings لا على ناتج logoSpec — الأخير كائن جديد كل مرّة */
  const logo = logoSpec(useSchoolStore((s) => s.settings));

  const editable = can("attendance.update") && can("attendance.create");

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];

  const [yearId, setYearId] = useState("");
  const [filters, setFilters] = useState<SheetFilters>(EMPTY_FILTERS);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetId, setSheetId] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [cells, setCells] = useState<Map<string, AttendanceRow>>(new Map());
  /**
   * فواتير الفترة — مفتاحُها التسجيل.
   *
   * الكشف كشفُ حضورٍ أوّلاً، لكنّ ورقة المؤسسة تكتب «مخلف» في عمود
   * الملاحظات بجانب الحاضر: الطالب حضر الثمانِ ولم يسدِّد، وهما خبران
   * مستقلّان يُقرآن في سطرٍ واحد. فبغير المال يفقد الكشف نصفَ ما في
   * الورقة — ويصير مَن يحمله إلى الأولياء لا يعرف بمن يبدأ.
   */
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [invoices, setInvoices] = useState<Map<string, Invoice>>(new Map());
  const [pendingNotes, setPendingNotes] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<ScheduleOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [picker, setPicker] = useState<{
    enrollmentId: string;
    sessionId: string;
    x: number;
    y: number;
  } | null>(null);

  const [columnMenu, setColumnMenu] = useState<{
    session: SheetSession;
    x: number;
    y: number;
  } | null>(null);
  const [dateDraft, setDateDraft] = useState("");

  /** حصةٌ يتيمة تحجز تاريخاً طُلب — تُعرض للضمّ لا للرفض */
  const [orphan, setOrphan] = useState<{
    session: SessionRow;
    date: string;
  } | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  /* السنة الافتراضية هي الجارية — لا أوّل ما يعود من الخادم */
  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  // --------------------------------------------------
  // الإسنادات — منها تُشتقّ كل قوائم التصفية
  // --------------------------------------------------

  useEffect(() => {
    if (!yearId) return;

    let alive = true;
    setLoadingRefs(true);
    setFilters(EMPTY_FILTERS);

    listAssignments(yearId)
      .then((rows) => alive && setAssignments(rows))
      .catch((err) => alive && setError(err?.response?.data?.message ?? "تعذّر جلب الإسنادات"))
      .finally(() => alive && setLoadingRefs(false));

    return () => {
      alive = false;
    };
  }, [yearId]);

  const options = useMemo(() => deriveOptions(assignments, filters), [assignments, filters]);
  const assignment = useMemo(() => resolveAssignment(assignments, filters), [assignments, filters]);

  /**
   * تغيير مرشِّح يُسقط ما تعارض معه من المرشِّحات الأخرى.
   *
   * بدل تصفير كل ما بعده: يُسقط الأدنى أولويةً واحداً تلو الآخر حتى يعود
   * الاختيار مطابقاً لإسنادٍ قائم.
   */
  const setFilter = (key: keyof SheetFilters, value: string) => {
    setFilters((prev) => {
      let next = { ...prev, [key]: value };
      const others = FILTER_ORDER.filter((k) => k !== key);

      while (!assignments.some((a) => matchesAll(a, next))) {
        const drop = [...others].reverse().find((k) => next[k]);
        if (!drop) break;
        next = { ...next, [drop]: "" };
      }

      return next;
    });
  };

  // --------------------------------------------------
  // كشوف الإسناد
  // --------------------------------------------------

  useEffect(() => {
    if (!assignment) {
      setSheets([]);
      setSheetId("");
      setSlots([]);
      return;
    }

    let alive = true;

    Promise.all([listSheets(assignment.id), listSchedulesOf(assignment.id)])
      .then(([rows, scheduleRows]) => {
        if (!alive) return;
        setSheets(rows);
        setSlots(scheduleRows);
        /* آخر كشف هو الجاري عادةً */
        setSheetId(rows.length > 0 ? rows[rows.length - 1].id : "");
      })
      .catch((err) => alive && setError(err?.response?.data?.message ?? "تعذّر جلب الكشوف"));

    return () => {
      alive = false;
    };
  }, [assignment]);

  // --------------------------------------------------
  // تحميل الكشف المختار
  // --------------------------------------------------

  const loadSheet = useCallback(async () => {
    if (!assignment || !sheetId) {
      setSheet(null);
      setEnrollments([]);
      setCells(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loaded, enrollmentRows] = await Promise.all([
        getSheet(sheetId),
        listEnrollments(assignment.id),
      ]);

      setSheet(loaded);
      setEnrollments(enrollmentRows);
      setNotes(new Map(enrollmentRows.map((e) => [e.student.id, e.student.note ?? ""])));
      setPendingNotes(new Set());

      /*
       * الحضور يُقرأ على مدى أعمدة الكشف — أضيقُ نطاقٍ يكفيها.
       * وكشفٌ بلا أعمدة لا حضور له، فلا طلب.
       */
      if (loaded.sessions.length > 0) {
        const dates = loaded.sessions.map((s) => isoDate(s.sessionDate)).sort();

        const rows = await listAttendance({
          teachingAssignmentId: assignment.id,
          dateFrom: dates[0],
          dateTo: dates[dates.length - 1],
        });

        const owned = new Set(loaded.sessions.map((s) => s.id));

        setCells(
          new Map(
            rows
              .filter((r) => owned.has(r.sessionId))
              .map((r) => [cellKey(r.studentEnrollmentId, r.sessionId), r]),
          ),
        );
      } else {
        setCells(new Map());
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر تحميل الكشف");
    } finally {
      setLoading(false);
    }
  }, [assignment, sheetId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2400);
  };

  const fail = (err: any, fallback: string) =>
    setError(err?.response?.data?.message ?? fallback);

  // --------------------------------------------------
  // الأعمدة
  // --------------------------------------------------

  const sessions = sheet?.sessions ?? [];
  const columnCount = sheet?.sessionCount ?? 0;
  /** الفارغة: أعمدةٌ لم يُكتب تاريخها بعد */
  const emptySlots = Math.max(0, columnCount - sessions.length);

  /**
   * ما يُقال قبل الطباعة — خبرٌ لا لوم.
   *
   * الورقة هنا تُطبع فارغةً عن قصدٍ كثيراً: تُسلَّم للأستاذ ليملأها
   * بالقلم. فالخانة غير المدوَّنة ليست خطأً يُحذَّر منه كما في كشف
   * الحقوق — والذي يستحقّ الذكر أنّ أعمدةً ستخرج بلا تاريخ، لأنّ من
   * ظنّها مكتوبةً سيبحث عنها في الورقة فلا يجدها.
   */
  const printWarning =
    emptySlots > 0
      ? `${emptySlots} من أعمدة الكشف لم يُكتب تاريخها بعد، فستخرج في الورقة بترويسةٍ فارغة تُملأ بالقلم.`
      : null;

  /**
   * كتابة تاريخ عمودٍ فارغ تُنشئ حصّته.
   *
   * وقد يكون التاريخ محجوزاً بحصةٍ **يتيمة**: حذفُ كشفٍ سابق يفكّ حصصه
   * ولا يمحوها — الحضور المسجَّل لا يضيع بحذف ورقة إدارية. فتبقى الحصة
   * بلا كشف، تحجز تاريخها ولا يراها أحد. وكان ذلك طريقاً مسدوداً:
   * الإنشاء يُرفض، والحصة لا تظهر لتُحذف أو تُستعمل.
   *
   * فتُلتقط هنا وتُعرض للضمّ بدل الوقوف عند رسالة رفض.
   */
  const fillSlot = async (date: string) => {
    if (!sheet || slots.length === 0 || !assignment) return;

    setBusyKey("new-slot");
    try {
      await createSession({
        scheduleId: slots[0].id,
        sessionDate: date,
        sheetId: sheet.id,
      });
      await loadSheet();
      flash("سُجّل تاريخ الحصة");
    } catch (err: any) {
      if (err?.response?.status === 409) {
        const found = await findSessionsOn(assignment.id, date).catch(() => []);
        const orphan = found.find((s) => !s.sheetId);

        if (orphan) {
          setOrphan({ session: orphan, date });
          setBusyKey(null);
          return;
        }
      }

      fail(err, "تعذّر تسجيل التاريخ");
    } finally {
      setBusyKey(null);
    }
  };

  /** ضمُّ الحصة اليتيمة إلى هذا الكشف — بحضورها المسجَّل إن وُجد */
  const adoptOrphan = async () => {
    if (!orphan || !sheet) return;

    setBusyKey("adopt");
    try {
      await adoptSession(orphan.session.id, sheet.id);
      setOrphan(null);
      await loadSheet();
      flash("ضُمَّت الحصة إلى الكشف");
    } catch (err: any) {
      fail(err, "تعذّر ضمّ الحصة");
    } finally {
      setBusyKey(null);
    }
  };

  const saveSessionDate = async (session: SheetSession, date: string) => {
    if (!date || date === isoDate(session.sessionDate)) {
      setColumnMenu(null);
      return;
    }

    setBusyKey(session.id);
    try {
      await updateSessionDate(session.id, date);
      setColumnMenu(null);
      await loadSheet();
      flash("عُدِّل تاريخ الحصة");
    } catch (err: any) {
      fail(err, "تعذّر تعديل التاريخ");
    } finally {
      setBusyKey(null);
    }
  };

  const dropSession = async (session: SheetSession) => {
    setBusyKey(session.id);
    try {
      await removeSession(session.id);
      setColumnMenu(null);
      await loadSheet();
      flash("حُذف العمود");
    } catch (err: any) {
      setError(
        err?.response?.status === 409
          ? "لا يُحذف عمودٌ فيه حضور مسجَّل — فرّغه أوّلاً بزرّ التفريغ."
          : (err?.response?.data?.message ?? "تعذّر حذف العمود"),
      );
      setColumnMenu(null);
    } finally {
      setBusyKey(null);
    }
  };

  // --------------------------------------------------
  // الحضور
  // --------------------------------------------------

  const setStatus = async (
    enrollmentId: string,
    sessionId: string,
    status: AttendanceStatus,
  ) => {
    const key = cellKey(enrollmentId, sessionId);
    const existing = cells.get(key);

    if (existing?.status === status) {
      setPicker(null);
      return;
    }

    /* الخلية تتبدّل الآن؛ الخادم يلحق. الارتداد يعيد ما كان بالضبط */
    const optimistic: AttendanceRow = existing
      ? { ...existing, status }
      : { id: `tmp:${key}`, studentEnrollmentId: enrollmentId, sessionId, status, note: null };

    setCells((prev) => new Map(prev).set(key, optimistic));
    setPicker(null);
    setBusyKey(key);

    try {
      const saved =
        existing && !existing.id.startsWith("tmp:")
          ? await updateAttendance(existing.id, { status })
          : await createAttendance({ sessionId, studentEnrollmentId: enrollmentId, status });

      setCells((prev) => new Map(prev).set(key, saved));
    } catch (err: any) {
      setCells((prev) => {
        const next = new Map(prev);
        if (existing) next.set(key, existing);
        else next.delete(key);
        return next;
      });
      fail(err, "تعذّر حفظ الحضور");
    } finally {
      setBusyKey(null);
    }
  };

  const markColumnPresent = async (sessionId: string) => {
    if (enrollments.length === 0) return;

    const before = new Map(cells);

    setCells((prev) => {
      const next = new Map(prev);
      for (const e of enrollments) {
        const key = cellKey(e.id, sessionId);
        next.set(key, {
          id: next.get(key)?.id ?? `tmp:${key}`,
          studentEnrollmentId: e.id,
          sessionId,
          status: "PRESENT",
          note: next.get(key)?.note ?? null,
        });
      }
      return next;
    });

    setBusyKey(sessionId);

    try {
      await bulkAttendance({
        sessionId,
        records: enrollments.map((e) => ({
          studentEnrollmentId: e.id,
          status: "PRESENT" as const,
        })),
      });
      await loadSheet();
      flash("سُجِّل الفوج حاضراً");
    } catch (err: any) {
      setCells(before);
      fail(err, "تعذّر تسجيل الحضور الجماعي");
    } finally {
      setBusyKey(null);
    }
  };

  /**
   * تفريغ عمود — نقيضُ الملء.
   *
   * تعود الخانات فارغة لا غياباً: من ملأ العمود الخطأ يريد إلغاء الفعل
   * لا قلبَه، والغيابُ ادّعاءٌ لم يحدث.
   */
  const clearColumn = async (sessionId: string) => {
    const before = new Map(cells);

    setCells((prev) => {
      const next = new Map(prev);
      for (const e of enrollments) next.delete(cellKey(e.id, sessionId));
      return next;
    });

    setBusyKey(sessionId);

    try {
      const { deleted } = await clearSessionAttendance(sessionId);
      flash(deleted > 0 ? `فُرِّغت ${deleted} خانة` : "العمود فارغ أصلاً");
    } catch (err: any) {
      setCells(before);
      setError(
        err?.response?.status === 403
          ? "لا صلاحية لتفريغ ورقة الحضور."
          : (err?.response?.data?.message ?? "تعذّر تفريغ العمود"),
      );
    } finally {
      setBusyKey(null);
    }
  };

  // --------------------------------------------------
  // الملاحظات
  // --------------------------------------------------

  const editNote = (studentId: string, value: string) => {
    setNotes((prev) => new Map(prev).set(studentId, value));
    setPendingNotes((prev) => new Set(prev).add(studentId));
  };

  const saveNotes = async (ids?: string[]) => {
    const targets = ids ?? [...pendingNotes];
    if (targets.length === 0) return;

    setSaving(true);
    try {
      await Promise.all(
        targets.map((id) => updateStudentNote(id, notes.get(id)?.trim() || null)),
      );
      setPendingNotes((prev) => {
        const next = new Set(prev);
        targets.forEach((id) => next.delete(id));
        return next;
      });
      flash("حُفظت الملاحظات");
    } catch (err: any) {
      fail(err, "تعذّر حفظ الملاحظات");
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // الكشف نفسه
  // --------------------------------------------------

  const addSheet = async (label: string, count: number) => {
    if (!assignment) return;

    const created = await createSheet({
      teachingAssignmentId: assignment.id,
      label: label.trim() || null,
      sessionCount: count,
    });

    setSheets((prev) => [...prev, created]);
    setSheetId(created.id);
    setNewOpen(false);
    flash(`أُنشئ ${sheetTitle(created)}`);
  };

  const rename = async (label: string, count: number) => {
    if (!sheet) return;

    const saved = await updateSheet(sheet.id, {
      label: label.trim() || null,
      sessionCount: count,
    });

    setSheets((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    setSheet(saved);
    setRenaming(false);
    flash("حُفظ الكشف");
  };

  const dropSheet = async () => {
    if (!sheet) return;

    setBusyKey("sheet");
    try {
      const { sessions: gone, marks } = await deleteSheet(sheet.id);
      const rest = sheets.filter((s) => s.id !== sheet.id);
      setSheets(rest);
      setSheetId(rest.length > 0 ? rest[rest.length - 1].id : "");
      setDropping(false);
      flash(
        gone > 0
          ? `حُذف الكشف و${gone} حصة و${marks} خانة حضور`
          : "حُذف الكشف",
      );
    } catch (err: any) {
      fail(err, "تعذّر حذف الكشف");
      setDropping(false);
    } finally {
      setBusyKey(null);
    }
  };

  // --------------------------------------------------
  // المجاميع — مشتقّة لا مخزَّنة
  // --------------------------------------------------

  /**
   * عمود «ع.ح» — الحاضر والمتأخّر في الحصص المنجزة وحدها.
   *
   * القاعدة في `fees.ts` لا هنا، لأنّ الكشف التقديري ومستحقّ الأستاذ
   * يقرآن منها أيضاً: عمودٌ يعدّ الحاضر وحده ثم مستحقٌّ يُبنى على
   * الحاضر والمتأخّر رقمان لا يُطابَق بينهما على الورقة.
   */
  const held = useMemo(() => heldSessions(sessions), [sessions]);

  /**
   * حقوق الفترة — تُجلب بالشهر التقويمي لأوّل حصةٍ في الكشف.
   *
   * وهي المطابقة نفسها المعتمدة في كشف الحقوق الشهري وفي التخليص، فلا
   * يقول كشفٌ «مخلَّف» ويقول آخرُ «خالص» عن الطالب نفسه في الفترة
   * نفسها.
   */
  useEffect(() => {
    /*
     * المرجع `sheet` لا `sessions`.
     *
     * `sessions` تُشتقّ بـ`sheet?.sessions ?? []`، فمرجعُ المصفوفة
     * الفارغة جديدٌ في كل تصيير. ووضعُها في التبعيات مع `setInvoices`
     * حلقةٌ لا تنتهي: تُشغَّل الدالّة، فتُبدَّل الحالة، فيُعاد التصيير،
     * فتتغيّر التبعية، فتُشغَّل من جديد.
     */
    const period = invoicePeriodOf(sheet?.sessions ?? []);

    if (!assignment || !period) {
      setInvoices(new Map());
      return;
    }

    let alive = true;

    (async () => {
      const found = new Map<string, Invoice>();
      let page = 1;

      try {
        for (;;) {
          const { invoices: rows, pagination } = await listInvoices({
            subjectId: assignment.subject.id,
            studyGroupId: assignment.studyGroup.id,
            month: period.month,
            year: period.year,
            limit: 100,
            page,
          });

          /* الملغاة ليست حقاً على الطالب */
          for (const invoice of rows) {
            if (invoice.status !== "CANCELLED") {
              found.set(invoice.studentEnrollment.id, invoice);
            }
          }

          if (!pagination || page >= pagination.totalPages || pagination.totalPages === 0) break;
          page++;
        }

        if (alive) setInvoices(found);
      } catch {
        /* الحضور يُدوَّن ولو تعذّر جلب المال — لا يُعطَّل الكشف لأجله */
        if (alive) setInvoices(new Map());
      }
    })();

    return () => { alive = false; };
  }, [assignment, sheet]);

  /** حالةُ الطالب المالية في هذه الفترة */
  const feeOf = (enrollmentId: string) => {
    const invoice = invoices.get(enrollmentId);

    return {
      invoice,
      state: feeStateOf(invoice) as FeeState,
      /** مخلَّف: عليه باقٍ في هذه المادة لهذه الفترة */
      defaulter: Boolean(invoice && invoice.remaining > 0),
    };
  };

  const presentCount = (enrollmentId: string) =>
    held.reduce(
      (sum, s) => {
        const record = cells.get(cellKey(enrollmentId, s.id));
        return sum + (record && isAttended(record.status) ? 1 : 0);
      },
      0,
    );

  const ready = Boolean(assignment);
  const hasSheet = Boolean(sheet) && enrollments.length > 0;
  const noSchedule = ready && slots.length === 0;

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="كشف الحضور اليومي" subtitle="كشفٌ يملك أعمدته — لا شهر ولا نافذة">
        <button
          onClick={() => exitTo(PATHS.attendance)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1600px] p-6">
        {/* ================= المرشِّحات ================= */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="mb-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="السنة الدراسية">
              <select value={yearId} onChange={(e) => setYearId(e.target.value)} className={selectClass}>
                {years.map((y) => (
                  <option key={y.id} value={y.id} className="bg-[#0a0f1a]">
                    {y.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="الطور">
              <Picker value={filters.stageId} onChange={(v) => setFilter("stageId", v)} items={options.stages} all="كل الأطوار" />
            </Field>

            <Field label="المستوى">
              <Picker value={filters.levelId} onChange={(v) => setFilter("levelId", v)} items={options.levels} all="كل المستويات" />
            </Field>

            <Field label="المادة">
              <Picker value={filters.subjectId} onChange={(v) => setFilter("subjectId", v)} items={options.subjects} all="اختر المادة" />
            </Field>

            <Field label="الأستاذ">
              <Picker
                value={filters.teacherId}
                onChange={(v) => setFilter("teacherId", v)}
                items={options.teachers.map((t) => ({ id: t.id, name: fullName(t) }))}
                all="اختر الأستاذ"
              />
            </Field>

            <Field label="الفوج">
              <Picker value={filters.groupId} onChange={(v) => setFilter("groupId", v)} items={options.groups} all="اختر الفوج" />
            </Field>

            {/* الكشف بدل الشهر: وحدةٌ إدارية لا مدىً تقويمي */}
            {ready && (
              <Field label="الكشف">
                <div className="flex items-center gap-2">
                  <select
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    className={selectClass}
                    disabled={sheets.length === 0}
                  >
                    {sheets.length === 0 ? (
                      <option value="" className="bg-[#0a0f1a]">لا كشوف بعد</option>
                    ) : (
                      sheets.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#0a0f1a]">
                          {sheetTitle(s)}
                        </option>
                      ))
                    )}
                  </select>

                  {can("attendance.create") && (
                    <button
                      onClick={() => setNewOpen(true)}
                      disabled={noSchedule}
                      title={noSchedule ? "لا خانة في الجدول الأسبوعي لهذا الإسناد" : "كشف جديد"}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black text-[#241202] transition hover:brightness-110 disabled:opacity-35"
                      style={{ background: ACCENT }}
                    >
                      <FilePlus2 className="h-4 w-4" />
                      كشف جديد
                    </button>
                  )}
                </div>
              </Field>
            )}

            {loadingRefs && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-white/40" />}
          </div>
        </motion.div>

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        {/* ================= ترويسة الكشف ================= */}
        {ready && sheet && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2.5 text-sm">
              <Meta label="المؤسسة" value={schoolName} strong />
              <Meta label="السنة الدراسية" value={assignment!.academicYear.name} />
              <Meta label="المادة" value={assignment!.subject.name} strong />
              <Meta label="الأستاذ" value={fullName(assignment!.teacher)} />
              <Meta label="الطور" value={assignment!.studyGroup.level.educationStage.name} />
              <Meta label="المستوى" value={assignment!.studyGroup.level.name} />
              <Meta label="الفوج" value={assignment!.studyGroup.name} />

              <span className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-white/40">الكشف:</span>
                <span className="font-black">{sheetTitle(sheet)}</span>
                {can("attendance.update") && (
                  <button
                    onClick={() => setRenaming(true)}
                    title="تسمية الكشف وعدد أعمدته"
                    className="grid h-5 w-5 place-items-center rounded text-white/35 transition hover:bg-white/10 hover:text-white"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </span>

              <span className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-white/40">عدد الحصص:</span>
                <span className="font-black" style={{ color: ACCENT }}>{sessions.length}</span>
                <span className="text-white/30">/ {columnCount}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => saveNotes()}
                disabled={pendingNotes.size === 0 || saving}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#241202] transition hover:brightness-110 disabled:opacity-35"
                style={{ background: ACCENT }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ
                {pendingNotes.size > 0 && ` (${pendingNotes.size})`}
              </button>

              <button
                onClick={loadSheet}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                تحديث
              </button>

              {/*
                الجسر إلى الحقوق.
                كشفٌ اكتمل تدوينه هو بالضبط ما يُحصَّل عليه، والانتقال كان
                يعني إعادةَ اختيار خمسة مرشِّحاتٍ في الشاشة الأخرى. فالرابط
                يحمل السنة والإسناد والكشف، وتفتح الشاشةُ على نفس الورقة.
              */}
              <button
                onClick={() =>
                  navigate(
                    `${PATHS.attendanceMonthlyFees}?y=${yearId}&a=${assignment!.id}&s=${sheet!.id}`,
                  )
                }
                disabled={!hasSheet}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-emerald-500/15 hover:text-emerald-200 disabled:opacity-35"
                title="حقوق هذا الكشف — نفس المادة والفوج والشهر"
              >
                <BadgeDollarSign className="h-4 w-4" />
                حقوق هذا الكشف
              </button>

              {/*
                الطباعة تمرّ بالمعاينة دائماً — لا زرَّ يطبع مباشرة.
                الورقة تُقرأ قبل أن تُتلَف، وفي المعاينة اختيارُ الطابعة
                واختيارُ الورقة وزرُّ الطباعة المباشرة.
              */}
              <button
                onClick={() => setPreviewing(true)}
                disabled={!hasSheet || sessions.length === 0}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-35"
              >
                <Printer className="h-4 w-4" />
                معاينة وطباعة
              </button>

              {can("attendance.delete") && (
                <button
                  onClick={() => setDropping(true)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/55 transition hover:bg-rose-500/15 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف الكشف
                </button>
              )}

              <span className="ms-auto text-[11px] text-white/35">
                الحضور يُحفظ لحظة تغييره — زرّ الحفظ للملاحظات وحدها
              </span>
            </div>
          </div>
        )}

        {/* ================= الجدول ================= */}
        {!ready ? (
          <Empty
            icon={ClipboardCheck}
            title="اختر المادة والأستاذ والفوج"
            hint="الكشف يُبنى على إسنادٍ واحد — القوائم تضيق تلقائياً كلّما اخترت."
          />
        ) : noSchedule ? (
          <Empty
            icon={CalendarDays}
            title="لا خانة لهذا الإسناد في الجدول الأسبوعي."
            hint="الحصة واقعةُ خانة، فلا كشف قبل الجدول. أضف الإسناد إلى شبكة الأسبوع أوّلاً."
            action={{ label: "الجدول الأسبوعي", to: PATHS.schedulesWeekly }}
          />
        ) : sheets.length === 0 ? (
          <Empty
            icon={FilePlus2}
            title="لا كشوف لهذا الفوج بعد."
            hint="أنشئ كشفاً؛ يفتح لك أعمدةً بعدد ما قرّرته المؤسسة، ثم تكتب في كل عمود تاريخه."
          />
        ) : loading ? (
          <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] py-24">
            <Loader2 className="h-7 w-7 animate-spin text-white/30" />
            <p className="mt-3 text-sm text-white/40">جارٍ تحميل الكشف…</p>
          </div>
        ) : enrollments.length === 0 ? (
          <Empty
            icon={UserX}
            title="لا يوجد طلاب مرتبطون بهذا الفوج."
            hint="سجّل الطلبة في هذه المادة من قسم التسجيلات."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="max-h-[62vh] overflow-auto">
              {/*
                border-separate لا border-collapse: الخلية اللاصقة تفقد
                حدودها في Chromium مع الطيّ، وهي هنا عمودان لاصقان تحت
                ترويسة لاصقة — أي بالضبط الحالة التي ينكسر فيها.
              */}
              <table className="w-full border-separate text-sm" style={{ borderSpacing: 0, minWidth: 720 }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#0b1120] text-xs text-white/60">
                    <th
                      className="sticky z-30 border-b border-e border-white/10 bg-[#0b1120] px-2 py-2.5 text-center font-bold"
                      style={{ insetInlineStart: 0, width: 54, minWidth: 54 }}
                    >
                      الترتيب
                    </th>
                    <th
                      className="sticky z-30 border-b border-e border-white/10 bg-[#0b1120] px-3 py-2.5 text-start font-bold"
                      style={{ insetInlineStart: 54, width: 210, minWidth: 210 }}
                    >
                      اسم ولقب الطالب
                    </th>

                    {sessions.map((s, i) => (
                      <th
                        key={s.id}
                        className="border-b border-e border-white/10 px-1.5 py-2 text-center font-bold"
                        style={{ width: 86, minWidth: 86 }}
                      >
                        <div className="whitespace-nowrap">الحصة {i + 1}</div>

                        {/* التاريخ مفتاحُ عمودِه: النقر يفتح تصحيحه وحذفه */}
                        <button
                          disabled={!can("session.update")}
                          onClick={(ev) => {
                            const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                            setDateDraft(isoDate(s.sessionDate));
                            setColumnMenu({ session: s, x: r.left + r.width / 2, y: r.bottom });
                          }}
                          className="mt-0.5 w-full rounded px-1 py-0.5 text-[10px] font-normal text-white/40 transition enabled:hover:bg-white/10 enabled:hover:text-white/80 disabled:cursor-default"
                          dir="ltr"
                          title={can("session.update") ? "تعديل تاريخ الحصة" : undefined}
                        >
                          {busyKey === s.id ? (
                            <Loader2 className="mx-auto h-3 w-3 animate-spin" />
                          ) : (
                            sheetDate(s.sessionDate)
                          )}
                        </button>

                        {/* الفعل ونقيضه جنباً إلى جنب — المخرج حيث يقع الخطأ */}
                        {editable && (
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <button
                              onClick={() => markColumnPresent(s.id)}
                              disabled={busyKey === s.id}
                              title="ملء العمود: الجميع حاضر"
                              className="grid h-5 w-5 place-items-center rounded-md text-white/40 transition hover:bg-emerald-500/20 hover:text-emerald-300 disabled:opacity-40"
                            >
                              {busyKey === s.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </button>

                            {can("attendance.delete") && (
                              <button
                                onClick={() => clearColumn(s.id)}
                                disabled={busyKey === s.id}
                                title="تفريغ العمود: تعود الخانات فارغة لا غياباً"
                                className="grid h-5 w-5 place-items-center rounded-md text-white/40 transition hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-40"
                              >
                                <Eraser className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </th>
                    ))}

                    {/*
                      الأعمدة الفارغة: الكشف يفتحها بعدد ما قرّرته
                      المؤسسة، ولا ينقصها إلّا تاريخها.
                    */}
                    {Array.from({ length: emptySlots }).map((_, i) => (
                      <th
                        key={`slot-${i}`}
                        className="border-b border-e border-white/10 bg-white/[0.02] px-1.5 py-2 text-center font-bold"
                        style={{ width: 86, minWidth: 86 }}
                      >
                        <div className="whitespace-nowrap text-white/35">
                          الحصة {sessions.length + i + 1}
                        </div>

                        {editable && can("session.create") ? (
                          <EmptySlot
                            busy={busyKey === "new-slot"}
                            onPick={fillSlot}
                            firstEmpty={i === 0}
                          />
                        ) : (
                          <div className="mt-1 text-[10px] text-white/20">بلا تاريخ</div>
                        )}
                      </th>
                    ))}

                    <th
                      className="border-b border-e border-white/10 px-2 py-2.5 text-center font-bold"
                      style={{ width: 92, minWidth: 92 }}
                    >
                      مجموع عدد الحصص
                    </th>
                    {/* الجانب المالي — خبرٌ مستقلٌّ عن الحضور يُقرأ في السطر نفسه */}
                    <th
                      className="border-b border-e border-white/10 px-2 py-2.5 text-center font-bold"
                      style={{ width: 104, minWidth: 104 }}
                    >
                      الحقّ الشهري
                    </th>
                    <th
                      className="border-b border-e border-white/10 px-2 py-2.5 text-center font-bold"
                      style={{ width: 96, minWidth: 96 }}
                    >
                      الدَّين
                    </th>
                    <th
                      className="border-b border-e border-white/10 px-3 py-2.5 text-start font-bold"
                      style={{ width: 180, minWidth: 180 }}
                    >
                      ملاحظات
                    </th>
                    {/*
                      الحالة مثبَّتةٌ في الطرف الآخر كما الاسمُ في هذا
                      الطرف. الجدول أعرضُ من الشاشة بطبعه — ثماني حصصٍ
                      وأكثر — فالتمرير يُخفي العمودَ الأخير، وهو الذي
                      يُقرأ من أجله الكشفُ نصفَ قراءة: مَن سدّد ومَن لا.
                    */}
                    <th
                      className="sticky z-20 border-b border-white/10 bg-[#070b14] px-2 py-2.5 text-center font-bold"
                      style={{ insetInlineEnd: 0, width: 96, minWidth: 96 }}
                    >
                      الحالة
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {enrollments.map((e, index) => {
                    const total = presentCount(e.id);
                    const dirty = pendingNotes.has(e.student.id);
                    const fee = feeOf(e.id);

                    return (
                      <tr key={e.id} className="transition hover:bg-white/[0.03]">
                        <td
                          className="sticky z-10 border-b border-e border-white/5 bg-[#070b14] px-2 py-1.5 text-center text-white/45"
                          style={{ insetInlineStart: 0 }}
                        >
                          {index + 1}
                        </td>
                        <td
                          className="sticky z-10 truncate border-b border-e border-white/5 bg-[#070b14] px-3 py-1.5 font-bold"
                          style={{ insetInlineStart: 54 }}
                          title={fullName(e.student)}
                        >
                          {fullName(e.student)}
                        </td>

                        {sessions.map((s) => {
                          const key = cellKey(e.id, s.id);
                          const record = cells.get(key);
                          const tone = record ? STATUS_TONE[record.status] : null;

                          return (
                            <td key={s.id} className="border-b border-e border-white/5 p-0 text-center">
                              <button
                                disabled={!editable || busyKey === key}
                                onClick={(ev) => {
                                  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                                  setPicker({
                                    enrollmentId: e.id,
                                    sessionId: s.id,
                                    x: r.left + r.width / 2,
                                    y: r.bottom,
                                  });
                                }}
                                className="grid h-9 w-full place-items-center text-base font-black transition enabled:hover:bg-white/10 disabled:cursor-default"
                                style={tone ? { background: tone.bg, color: tone.fg } : undefined}
                                title={tone ? tone.label : "لم يُسجَّل"}
                              >
                                {busyKey === key ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
                                ) : tone ? (
                                  tone.short
                                ) : (
                                  <span className="text-white/15">·</span>
                                )}
                              </button>
                            </td>
                          );
                        })}

                        {/* خانات الأعمدة الفارغة: لا حضور قبل تاريخ */}
                        {Array.from({ length: emptySlots }).map((_, i) => (
                          <td
                            key={`empty-${i}`}
                            className="border-b border-e border-white/5 bg-white/[0.015] p-0 text-center"
                          >
                            <span className="grid h-9 w-full place-items-center text-white/10">—</span>
                          </td>
                        ))}

                        <td className="border-b border-e border-white/5 px-2 py-1.5 text-center">
                          <span className="font-black" style={{ color: ACCENT }}>{total}</span>
                          {/* المقام المنجزة لا كل الأعمدة — وإلّا بدا الحاضرُ في كلّها ناقصاً */}
                          <span className="text-white/25"> / {held.length}</span>
                        </td>

                        {/* المبلغ لاتينيّ الاتجاه في محتواه لا في خانته */}
                        <td className="border-b border-e border-white/5 px-2 py-1.5 text-center text-[13px] text-white/60">
                          <span dir="ltr" className="tabular-nums">
                            {fee.invoice ? money(fee.invoice.total) : "—"}
                          </span>
                        </td>

                        <td
                          className="border-b border-e border-white/5 px-2 py-1.5 text-center text-[13px] font-bold"
                          style={{ color: fee.defaulter ? "#fda4af" : "rgba(255,255,255,0.35)" }}
                        >
                          <span dir="ltr" className="tabular-nums">
                            {fee.invoice ? money(fee.invoice.remaining) : "—"}
                          </span>
                        </td>

                        <td className="border-b border-e border-white/5 px-1.5 py-1">
                          <input
                            value={notes.get(e.student.id) ?? ""}
                            onChange={(ev) => editNote(e.student.id, ev.target.value)}
                            onBlur={() => dirty && saveNotes([e.student.id])}
                            placeholder="—"
                            maxLength={300}
                            className="w-full rounded-lg border bg-transparent px-2 py-1.5 text-[13px] outline-none transition placeholder:text-white/20 focus:border-white/25"
                            style={{ borderColor: dirty ? `${ACCENT}66` : "transparent" }}
                          />
                        </td>

                        {/* مثبَّتةٌ في الطرف — تبقى مرئيةً مهما مُرِّر الجدول */}
                        <td
                          className="sticky z-10 border-b border-white/5 bg-[#070b14] px-2 py-1.5 text-center"
                          style={{ insetInlineEnd: 0 }}
                        >
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{
                              background: FEE_TONE[fee.state].bg,
                              color: FEE_TONE[fee.state].fg,
                            }}
                          >
                            {fee.defaulter && fee.state !== "PARTIAL" ? "مخلَّف" : FEE_LABEL[fee.state]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/40">
              <span>
                {enrollments.length} طالباً · {sessions.length} حصة مؤرَّخة
                {emptySlots > 0 && ` · ${emptySlots} عمود بلا تاريخ`}
              </span>
              {(Object.keys(STATUS_TONE) as AttendanceStatus[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className="grid h-4 w-4 place-items-center rounded text-[10px] font-black"
                    style={{ background: STATUS_TONE[s].bg, color: STATUS_TONE[s].fg }}
                  >
                    {STATUS_TONE[s].short}
                  </span>
                  {STATUS_TONE[s].label}
                </span>
              ))}
              {!editable && <span className="text-amber-300/70">للعرض فقط — لا صلاحية تعديل</span>}
            </div>
          </div>
        )}
      </div>

      {/* ================= منتقي الحالة ================= */}
      {picker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPicker(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: MOTION.duration.instant }}
            className="fixed z-50 w-40 overflow-hidden rounded-xl border border-white/15 bg-[#0a0f1a] p-1 shadow-2xl"
            style={{
              left: Math.min(Math.max(picker.x - 80, 8), window.innerWidth - 168),
              top: Math.min(picker.y + 6, window.innerHeight - 190),
            }}
          >
            {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map((s) => {
              const tone = STATUS_TONE[s];
              const active = cells.get(cellKey(picker.enrollmentId, picker.sessionId))?.status === s;

              return (
                <button
                  key={s}
                  onClick={() => setStatus(picker.enrollmentId, picker.sessionId, s)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold transition hover:bg-white/10"
                  style={active ? { background: tone.bg, color: tone.fg } : undefined}
                >
                  <span
                    className="grid h-5 w-5 place-items-center rounded text-[11px] font-black"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {tone.short}
                  </span>
                  {tone.label}
                  {active && <Check className="ms-auto h-3.5 w-3.5" />}
                </button>
              );
            })}
          </motion.div>
        </>
      )}

      {/* ================= تاريخ العمود ================= */}
      {orphan && (
        <>
          <div onClick={() => setOrphan(null)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: MOTION.duration.fast }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-115 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6"
          >
            <h3 className="mb-2 text-lg font-black">حصةٌ موجودة بلا كشف</h3>

            <p className="mb-4 text-sm leading-relaxed text-white/60">
              يوم <span className="font-bold text-white" dir="ltr">{sheetDate(orphan.session.sessionDate)}</span>{" "}
              فيه حصةٌ مسجَّلة لهذا الإسناد، لكنّها لا تنتمي إلى أيّ كشف —
              غالباً لأنّ كشفاً سابقاً حُذف، والحصص لا تُمحى مع الكشف حتى لا
              يضيع الحضور المدوَّن فيها.
            </p>

            <div className="mb-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white/45">رقم الحصة</span>
                <span className="font-bold">{orphan.session.lessonNumber}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-white/45">الحالة</span>
                <span className="font-bold">{orphan.session.status === "COMPLETED" ? "منجزة" : orphan.session.status === "CANCELLED" ? "ملغاة" : "مجدولة"}</span>
              </div>
            </div>

            <p className="mb-4 text-[11px] leading-relaxed text-white/35">
              ضمُّها يُبقي حضورها كما هو ويجعلها عموداً في هذا الكشف. وإنشاء
              حصةٍ ثانية بنفس التاريخ ممنوع — حصّتان للجدول نفسه في يومٍ واحد
              خطأُ بيانات.
            </p>

            <div className="flex gap-3">
              <button
                onClick={adoptOrphan}
                disabled={busyKey === "adopt"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-[#241202] transition hover:brightness-110 disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {busyKey === "adopt" ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Check className="h-4.5 w-4.5" />
                )}
                ضُمَّها إلى الكشف
              </button>
              <button
                onClick={() => setOrphan(null)}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </>
      )}

      {columnMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setColumnMenu(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: MOTION.duration.instant }}
            className="fixed z-50 w-64 rounded-xl border border-white/15 bg-[#0a0f1a] p-3 shadow-2xl"
            style={{
              left: Math.min(Math.max(columnMenu.x - 128, 8), window.innerWidth - 264),
              top: Math.min(columnMenu.y + 6, window.innerHeight - 220),
            }}
          >
            <p className="mb-2 text-[11px] font-bold text-white/50">تاريخ الحصة</p>

            <div className="space-y-2">
              <DateField value={dateDraft} onChange={setDateDraft} tone={ACCENT} />

              <button
                onClick={() => setDateDraft(today())}
                title="تاريخ اليوم"
                className="w-full rounded-lg bg-white/10 py-1.5 text-[11px] font-bold transition hover:bg-white/20"
              >
                اليوم
              </button>
            </div>

            <p className="mt-2 text-[10px] leading-relaxed text-white/35">
              العمود يبقى في هذا الكشف مهما كان تاريخه — الكشف يملك أعمدته.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => saveSessionDate(columnMenu.session, dateDraft)}
                disabled={busyKey === columnMenu.session.id}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-[#241202] transition hover:brightness-110 disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {busyKey === columnMenu.session.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                حفظ
              </button>

              {can("session.delete") && (
                <button
                  onClick={() => dropSession(columnMenu.session)}
                  disabled={busyKey === columnMenu.session.id}
                  title="حذف العمود"
                  className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}

      {newOpen && assignment && (
        <SheetDialog
          title="كشف جديد"
          hint={`يفتح ${sheets.length === 0 ? "أعمدةً" : "أعمدةً جديدة"} بعدد ما قرّرته المؤسسة، ولا ينقصها إلّا التاريخ. الرقم يُحسب تلقائياً.`}
          defaultLabel=""
          defaultCount={years.find((y) => y.id === yearId)?.sessionsPerMonth ?? 8}
          submitLabel="إنشاء"
          onClose={() => setNewOpen(false)}
          onSubmit={addSheet}
        />
      )}

      {renaming && sheet && (
        <SheetDialog
          title="تسمية الكشف"
          hint="التسمية تُغني عن الرقم. اتركها فارغة ليُعرض «الشهر رقم N»."
          defaultLabel={sheet.label ?? ""}
          defaultCount={sheet.sessionCount}
          minCount={sessions.length || 1}
          submitLabel="حفظ"
          onClose={() => setRenaming(false)}
          onSubmit={rename}
        />
      )}

      {dropping && sheet && (
        <>
          <div onClick={() => setDropping(false)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-105 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6">
            <h3 className="mb-2 text-lg font-black">حذف الكشف</h3>
            {/*
              الحذف صار يمحو — فيجب أن يُقرأ العددُ قبل الضغط لا بعده.
              «سيُحذف الكشف» جملةٌ لا تُخيف، و«96 خانة حضور» رقمٌ يُوقف
              اليد. والعددان محسوبان من الكشف المعروض لا مقدَّرَين.
            */}
            <p className="mb-4 text-sm leading-relaxed text-white/60">
              سيُحذف <span className="font-bold text-white">{sheetTitle(sheet)}</span> ومعه
              حصصُه وكلُّ حضورٍ دُوِّن فيها. <span className="font-bold text-rose-200">لا رجعة في هذا.</span>
            </p>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3">
              <span className="text-xs text-white/50">سيُمحى</span>
              <span className="text-sm font-black text-rose-200">
                {sessions.length} حصة · {cells.size} خانة حضور
              </span>
            </div>
            <p className="mb-5 text-[11px] leading-relaxed text-white/40">
              ولا تُمَسّ الفواتير ولا الدفعات ولا الإيصالات، ولا حصصُ كشفٍ آخر.
              وكشفٌ خُلّص عليه لا يُحذف حتى يُلغى تخليصُه.
            </p>
            <div className="flex gap-3">
              <button
                onClick={dropSheet}
                disabled={busyKey === "sheet"}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 font-bold transition hover:bg-rose-400 disabled:opacity-50"
              >
                {busyKey === "sheet" && <Loader2 className="h-4 w-4 animate-spin" />}
                حذف الكشف
              </button>
              <button
                onClick={() => setDropping(false)}
                className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold transition hover:bg-white/20"
              >
                تراجع
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-2.5 text-sm font-bold text-emerald-100 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}

      {/* ================= المعاينة والورقة ================= */}
      {previewing && hasSheet && sheet && sessions.length > 0 && (
        <SheetPreview
          title="كشف الحضور اليومي"
          subtitle={`${assignment!.subject.name} · ${assignment!.studyGroup.level.name} · ${assignment!.studyGroup.name} · ${sheetTitle(sheet)}`}
          warning={printWarning}
          onClose={() => setPreviewing(false)}
        >
          <SheetPrint
            schoolName={schoolName}
            assignment={assignment!}
            title={sheetTitle(sheet)}
            sessions={sessions}
            enrollments={enrollments}
            cells={cells}
            notes={notes}
            invoices={invoices}
            logo={logo}
          />
        </SheetPreview>
      )}
    </div>
  );
}

// --------------------------------------------------
// عناصر مساعدة
// --------------------------------------------------

const selectClass =
  "rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition focus:border-white/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-white/45">{label}</span>
      {children}
    </label>
  );
}

function Picker({
  value,
  onChange,
  items,
  all,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { id: string; name: string }[];
  all: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="" className="bg-[#0a0f1a]">{all}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id} className="bg-[#0a0f1a]">{i.name}</option>
      ))}
    </select>
  );
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-white/40">{label}:</span>
      <span className={strong ? "font-black" : "font-bold text-white/85"}>{value || "—"}</span>
    </span>
  );
}

function Empty({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  hint: string;
  action?: { label: string; to: string };
}) {
  const navigate = useNavigate();

  return (
    <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
      <Icon className="mb-3 h-11 w-11 text-white/15" />
      <p className="text-white/60">{title}</p>
      <p className="mt-1.5 max-w-md text-xs text-white/35">{hint}</p>

      {action && (
        <button
          onClick={() => {
            uiSound("navigate");
            navigate(action.to);
          }}
          className="mt-5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#241202] transition hover:brightness-110"
          style={{ background: ACCENT }}
        >
          <CalendarClock className="h-4 w-4" />
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * عمودٌ بلا تاريخ.
 *
 * التاريخ وحده ما ينقصه — لا خانة جدول ولا رقم حصة ولا شهر. وزرّ
 * «اليوم» يقرأ ساعة الجهاز لأنّ الورقة تُملأ يومَ الحصة عادةً.
 */
function EmptySlot({
  busy,
  onPick,
  firstEmpty,
}: {
  busy: boolean;
  onPick: (date: string) => void;
  firstEmpty: boolean;
}) {
  /**
   * التاريخ يُختار ثمّ يُؤكَّد — لا يُحفظ مع كل تغيير.
   *
   * كان الحفظ معلَّقاً بـ`onChange` مباشرةً، وهذا يعمل مع القوائم كما
   * مع الكتابة — إلّا أنّ أوّل تغييرٍ كان يُنشئ الحصة ويُعيد تحميل
   * الكشف، فيُفكَّك هذا المكوّن وتضيع بقيّة الاختيار. فلا يبلغ
   * المستخدم الشهرَ والسنة أصلاً.
   */
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());

  if (busy) {
    return (
      <div className="mt-1 grid h-6 place-items-center">
        <Loader2 className="h-3 w-3 animate-spin text-white/40" />
      </div>
    );
  }

  if (open) {
    return (
      <div className="mt-1 space-y-1">
        <DateField value={date} onChange={setDate} compact tone={ACCENT} />

        <div className="flex gap-1">
          <button
            onClick={() => onPick(date)}
            className="flex-1 rounded py-0.5 text-[10px] font-black text-[#241202] transition hover:brightness-110"
            style={{ background: ACCENT }}
          >
            تأكيد
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60 transition hover:bg-white/20"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <button
        onClick={() => {
          setDate(todayIso());
          setOpen(true);
        }}
        title="أدخل تاريخ هذه الحصة"
        className="w-full rounded border border-dashed border-white/15 py-0.5 text-[10px] text-white/45 transition hover:border-white/40 hover:text-white/70"
      >
        تاريخ…
      </button>

      {firstEmpty && (
        <button
          onClick={() => onPick(today())}
          title="تاريخ اليوم من ساعة الجهاز"
          className="w-full rounded bg-white/[0.06] py-0.5 text-[10px] font-bold text-white/50 transition hover:bg-white/15 hover:text-white"
        >
          اليوم
        </button>
      )}
    </div>
  );
}

// --------------------------------------------------
// إنشاء الكشف وتسميته
// --------------------------------------------------

function SheetDialog({
  title,
  hint,
  defaultLabel,
  defaultCount,
  minCount = 1,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  hint: string;
  defaultLabel: string;
  defaultCount: number;
  minCount?: number;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (label: string, count: number) => Promise<void>;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const [count, setCount] = useState(defaultCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(label, count);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّرت العملية");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.duration.fast }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-115 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6"
      >
        <h3 className="mb-1 text-lg font-black">{title}</h3>
        <p className="mb-5 text-xs leading-relaxed text-white/45">{hint}</p>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">
              التسمية <span className="font-normal text-white/35">(اختيارية)</span>
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={60}
              placeholder="مثال: الشهر السادس"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none transition focus:border-white/30"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">عدد الأعمدة</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCount((c) => Math.max(minCount, c - 1))}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg font-black transition hover:bg-white/20"
              >
                −
              </button>
              <input
                type="number"
                min={minCount}
                max={31}
                value={count}
                onChange={(e) => setCount(Math.min(31, Math.max(minCount, Number(e.target.value) || minCount)))}
                dir="ltr"
                className="w-20 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-center text-xl font-black outline-none transition focus:border-white/30"
              />
              <button
                onClick={() => setCount((c) => Math.min(31, c + 1))}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-lg font-black transition hover:bg-white/20"
              >
                +
              </button>
              <span className="text-[11px] text-white/35">
                منسوخٌ عن سياسة السنة — يخصّ هذا الكشف وحده
              </span>
            </div>
          </label>

          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-200">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={submit}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-[#241202] transition hover:brightness-110 disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <CalendarPlus className="h-4.5 w-4.5" />}
              {submitLabel}
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// --------------------------------------------------
// الورقة المطبوعة
//
// نسخة مستقلّة عن جدول الشاشة عمداً: المطبوع أبيض بحدود سوداء وبلا
// أزرار ولا ألوان خلفية، والشاشة عكس ذلك تماماً.
// --------------------------------------------------

/** الورقة الأصلية مرقَّمة إلى 25 صفاً، وهو ما يملأ A4 أفقية تماماً */
const PRINT_ROWS_PER_PAGE = 25;

/**
 * الورقة المطبوعة.
 *
 * التقسيم إلى صفحاتٍ صريح لا متروكٌ للمتصفّح: الترقيم «الصفحة 1 من 2»
 * لا يمكن حسابه في CSS (‏Chromium لا يدعم صناديق هوامش `@page`)، فلو
 * تُرك التقطيع للمتصفّح لتعذّر ترقيمُها. وحين نقطّعها بأنفسنا تُعرف
 * الصفحاتُ عدداً وترتيباً، وتتكرّر الترويسة كاملةً على كل ورقة.
 */
function SheetPrint({
  schoolName,
  assignment,
  title,
  sessions,
  enrollments,
  cells,
  notes,
  invoices,
  logo,
}: {
  schoolName: string;
  assignment: Assignment;
  title: string;
  sessions: SheetSession[];
  enrollments: EnrollmentRow[];
  cells: Map<string, AttendanceRow>;
  notes: Map<string, string>;
  invoices: Map<string, Invoice>;
  logo: LogoSpec;
}) {
  const rows = Math.max(enrollments.length, PRINT_ROWS_PER_PAGE);
  const pages = Math.ceil(rows / PRINT_ROWS_PER_PAGE);
  const printedOn = new Date().toLocaleDateString("fr-DZ");

  /*
   * الأعمدة كلّها تُطبع — المجدولة والملغاة معها، فالورقة تُظهر ما في
   * الكشف كما هو. والعدّ وحده يقتصر على المنجزة.
   */
  const held = heldSessions(sessions);

  /*
   * الشعار على الورقة أكبر منه على الإيصال: الإيصال شريطٌ عرضه 80mm
   * والورقة 297mm، فقياسٌ واحد يخدم أحدهما ويضيع في الآخر.
   */
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));

  return (
    <div className="sheet-print" dir="rtl">
      {Array.from({ length: pages }).map((_, page) => {
        const from = page * PRINT_ROWS_PER_PAGE;

        return (
          <section className="sheet-page" key={page}>
            {/*
              ترويسةٌ ثلاثية المناطق كما في الورقة: المستوى والكشف
              يميناً، وهوية المؤسسة وعنوان الوثيقة وسطاً، والمادة
              والفوج والأستاذ يساراً. والشعار وحده زيادةٌ على الأصل.
            */}
            <header className="sheet-print-top">
              <div className="sheet-print-side">
                <span>المستوى: {assignment.studyGroup.level.name}</span>
                <span>{title}</span>
                <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
              </div>

              <div className="sheet-print-center">
                {logo.src && (
                  <img
                    src={logo.src}
                    alt=""
                    className="sheet-print-logo"
                    style={{ width: `${logoWidth}mm`, filter: logo.filter }}
                  />
                )}
                <h1>{schoolName}</h1>
                <div className="sheet-print-year">{assignment.academicYear.name}</div>
                <h2>كشف الحضور اليومي</h2>
              </div>

              <div className="sheet-print-side sheet-print-side-end">
                <span>المادة: {assignment.subject.name}</span>
                <span>الفوج: {assignment.studyGroup.name}</span>
                <span>أستاذ المادة: {fullName(assignment.teacher)}</span>
              </div>
            </header>

            <table className="sheet-print-table">
              <thead>
                <tr>
                  <th rowSpan={3} style={{ width: "5%" }}>الترتيب</th>
                  <th rowSpan={3} style={{ width: "18%" }}>اسم ولقب الطالب</th>
                  <th colSpan={sessions.length}>تاريخ الحضور</th>
                  <th rowSpan={3} style={{ width: "7%" }}>مجموع عدد الحصص</th>
                  <th rowSpan={3} style={{ width: "9%" }}>الحقّ الشهري</th>
                  <th rowSpan={3} style={{ width: "8%" }}>الدَّين</th>
                  <th rowSpan={3} style={{ width: "12%" }}>ملاحظــات</th>
                </tr>
                <tr>
                  {sessions.map((s) => (
                    <th key={s.id} className="sheet-print-date">
                      {sheetDate(s.sessionDate)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {sessions.map((s, i) => (
                    <th key={s.id}>الحصة {i + 1}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {Array.from({ length: PRINT_ROWS_PER_PAGE }).map((_, offset) => {
                  const index = from + offset;
                  const e = enrollments[index];

                  if (!e) {
                    /* صفٌّ مرقَّم فارغ — الورقة تُطبع كاملةً وتُملأ بالقلم */
                    return (
                      <tr key={`blank-${index}`}>
                        <td className="c">{index + 1}</td>
                        <td />
                        {sessions.map((s) => (
                          <td key={s.id} />
                        ))}
                        <td />
                        <td />
                        <td />
                        <td />
                      </tr>
                    );
                  }

                  /* نفس قاعدة الشاشة — الحاضر والمتأخّر في المنجزة وحدها */
                  const total = held.reduce((sum, s) => {
                    const record = cells.get(cellKey(e.id, s.id));
                    return sum + (record && isAttended(record.status) ? 1 : 0);
                  }, 0);

                  const invoice = invoices.get(e.id);
                  const debt = invoice?.remaining ?? 0;
                  const note = notes.get(e.student.id) ?? "";

                  /*
                   * «مخلف» تُكتب من نفسها كما في الورقة الأصلية.
                   *
                   * كانت تُكتب باليد فتُنسى أو تبقى بعد السداد. ومصدرُها
                   * هنا `Invoice.remaining`، فتظهر بظهور الدَّين وتزول
                   * بزواله بلا خطوةٍ ثانية. وملاحظةُ الموظّف تبقى بجانبها
                   * لا تُمحى.
                   */
                  const remark = [debt > 0 ? "مخلف" : "", note]
                    .filter(Boolean)
                    .join(" — ");

                  return (
                    <tr key={e.id}>
                      <td className="c">{index + 1}</td>
                      <td>{fullName(e.student)}</td>
                      {sessions.map((s) => {
                        const record = cells.get(cellKey(e.id, s.id));
                        return (
                          <td key={s.id} className="c">
                            {record ? STATUS_TONE[record.status].short : ""}
                          </td>
                        );
                      })}
                      <td className="c b">{total}</td>
                      <td className="c">{invoice ? money(invoice.total) : ""}</td>
                      <td className="c b">{debt > 0 ? money(debt) : ""}</td>
                      <td>{remark}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <footer className="sheet-print-foot">
              {pages > 1 ? `الصفحة ${page + 1} من ${pages}` : "الصفحة 1"}
            </footer>
          </section>
        );
      })}
    </div>
  );
}
