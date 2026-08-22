import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpLeft,
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
import { dropBlankPages, SHEET_MM, usePagedRows } from "../../components/print/paged-sheet";
import { printedStamp } from "../../components/print/printed-at";
import { SheetBarcode } from "../../components/print/SheetBarcode";
import { SheetPreview } from "../../components/print/SheetPreview";
import {
  FilterField,
  FilterPanel,
  FilterSelect,
  type FilterChip,
} from "../../components/shared/FilterPanel";
import { SearchBox } from "../../components/shared/SearchBox";
import { useAcademicYears } from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { cancelPendingTransfer } from "../enrollments/enrollments.api";
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
  filterSummary,
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
  sheetDateShort,
  sheetCode,
  sheetTitle,
  updateAttendance,
  adoptSession,
  findSessionsOn,
  updateSessionDate,
  updateSheet,
  updateStudentNote,
  deleteAttendance,
  listDeparted,
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
import { matchesQuery } from "../../lib/search";
import { SheetScanner } from "./components/sheet-scan";
import { useSheetJump } from "./hooks/use-sheet-jump";

const ACCENT = "#fcd34d";

/** ثلاثُ نبضاتٍ في `skk-row-glow` — والمدّة هنا صورةٌ عن مدّتها هناك */
const GLOW_MS = 3 * 900;

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
  /** بحثٌ داخل الكشف المفتوح — عرضٌ لا حذف: الطباعة والمجاميع على الكشف كلِّه */
  const [search, setSearch] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetId, setSheetId] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  /**
   * من غادر هذا الفوج بالنقل — بمعزلٍ عن `enrollments` عمداً.
   *
   * دمجُهما كان يُدخل المغادِر في كلّ ما يُشتقّ من القائمة: المجاميع،
   * وعدّاد «14 طالباً»، والفواتير، والورقة المطبوعة، وشرطُ إنجاز
   * الحصة. وهو لا يخصّه شيءٌ من ذلك — سطرُه خبرٌ لا حساب.
   */
  const [departed, setDeparted] = useState<EnrollmentRow[]>([]);
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

  /*
   * القدوم من ورقةٍ أخرى — `?y=سنة&a=إسناد&s=كشف`.
   *
   * الشاشة تُفتح بخمسة مرشِّحاتٍ فارغة، فمن جاء من الحقوق أو من الكشف
   * التقديري يعيد اختيارها كلَّها ثمّ يبحث عن رقم الكشف. فيُقرأ الرابط
   * على ثلاث مراحل — السنة تُحمّل الإسنادات، والإسناد يملأ المرشِّحات
   * ويُحمّل الكشوف، والكشف يُختار حين يصير موجوداً — ثمّ يُمحى الرابط
   * كي لا يعيد الاختيار على المستخدم إن بدّل بيده بعدها.
   */
  const [params, setParams] = useSearchParams();
  const linkYear = params.get("y");
  const linkAssignment = params.get("a");
  const linkSheet = params.get("s");
  /** بحثٌ مسبَق — به يُشار إلى طالبٍ بعينه في الكشف المقصود */
  const linkQuery = params.get("q");

  /**
   * الطالبُ المقصود بالرابط — يتوهّج سطرُه ثلاث نبضاتٍ ثمّ يسكن.
   *
   * البحثُ وحده لا يكفي دلالةً: من قفز من كشفٍ إلى كشفٍ يصل إلى ورقةٍ
   * غير التي كان ينظر إليها، فيبحث ببصره عن السطر الذي جاء لأجله.
   * والتوهّجُ يقع عند القدوم وحده لا كلّما كُتب اسمٌ في خانة البحث.
   */
  const [glowFor, setGlowFor] = useState<string | null>(null);

  /** سطرُ المقصود — إليه يُمرَّر الجدول حين يُرسم */
  const glowRow = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!linkQuery) return;

    setSearch(linkQuery);
    setGlowFor(linkQuery);
  }, [linkQuery]);

  useEffect(() => {
    if (linkYear) setYearId(linkYear);
  }, [linkYear]);

  useEffect(() => {
    if (!linkAssignment || assignments.length === 0) return;

    const target = assignments.find((a) => a.id === linkAssignment);
    if (!target) return;

    setFilters({
      stageId: target.studyGroup.level.educationStage.id,
      levelId: target.studyGroup.level.id,
      subjectId: target.subject.id,
      teacherId: target.teacher.id,
      groupId: target.studyGroup.id,
    });
  }, [linkAssignment, assignments]);

  useEffect(() => {
    if (!linkSheet || !sheets.some((s) => s.id === linkSheet)) return;

    setSheetId(linkSheet);
    setParams({}, { replace: true });
  }, [linkSheet, sheets, setParams]);

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

  /*
   * المسح ينقل الشاشة كلَّها إلى كشفٍ آخر — السنة والمرشِّحات والكشف.
   * انظر `use-sheet-jump` لسبب تقسيمه على ثلاث دفعات.
   */
  const { jumpTo, jumping } = useSheetJump({
    assignments,
    sheets,
    setYearId,
    setFilters,
    setSheetId,
  });

  // --------------------------------------------------
  // كشوف الإسناد
  // --------------------------------------------------

  useEffect(() => {
    /* الفوجُ تبدّل، فبحثُ الفوج السابق لا معنى له في جدولٍ آخر */
    setSearch("");

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
      setDeparted([]);
      setCells(new Map());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [loaded, enrollmentRows, departedRows] = await Promise.all([
        getSheet(sheetId),
        listEnrollments(assignment.id),
        listDeparted(assignment.id),
      ]);

      setSheet(loaded);
      setEnrollments(enrollmentRows);
      setDeparted(departedRows);
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

  /*
   * مرجعٌ ثابتٌ ما ثبت الكشف.
   *
   * `sheet?.sessions ?? []` تُنشئ مصفوفةً جديدة في كلّ رسمة، فكلُّ
   * `useMemo` يعتمد عليها لا يحفظ شيئاً — يُعاد حسابُه دائماً. وهي
   * تُقرأ في ثلاثة مواضع، منها ترشيحُ المغادرين على كلّ خلايا الكشف.
   */
  const sessions = useMemo(() => sheet?.sessions ?? [], [sheet]);
  const columnCount = sheet?.sessionCount ?? 0;
  /** الفارغة: أعمدةٌ لم يُكتب تاريخها بعد */
  const emptySlots = Math.max(0, columnCount - sessions.length);

  /**
   * أهلُ هذا الكشف — والوافدُ لا يُدرج فيما سبق وصولَه.
   *
   * التسجيلُ نشطٌ فيُرجعه الخادم مع كشوف الفوج كلِّها، فكان من وصل في
   * الكشف الثالث يظهر في الأوّل والثاني بصفرٍ من صفر وشُرَطٍ في كلّ
   * خانة — سطرٌ لا معنى له في ورقةٍ طُويت قبل أن يعرفه الفوج، ويزحزح
   * ترتيبَ من كان فيها.
   *
   * والمقياسُ رقمُ الكشف لا التاريخ: الورقة وحدةٌ إدارية تحمل «الشهر
   * 2»، وحصصُها قد تُؤرَّخ بأيّ شهر. فما كان رقمُه دون كشفِ وصوله فهو
   * قبله، وما ساواه أو علاه فمن أيّامه — ومنه الكشفُ الجديد الفارغ:
   * رقمُه أعلى فيظهر فيه من أوّل يوم.
   *
   * وعلامةٌ له في ورقةٍ قديمة تُبقيه فيها مهما قال الرقم: الأثرُ أصدق
   * من الاستنتاج، ولا تُطوى ورقةٌ فيها خطُّ يدٍ عنه.
   */
  const roster = useMemo(() => {
    const numberOf = new Map(sheets.map((s) => [s.id, s.number]));
    const current = sheet?.number;

    return enrollments.filter((row) => {
      if (!row.transferAt || row.pendingTransferToId || !row.isActive) return true;
      if (!row.transferSheetId || current === undefined) return true;

      const arrived = numberOf.get(row.transferSheetId);
      if (arrived === undefined || current >= arrived) return true;

      return sessions.some((s) => cells.has(cellKey(row.id, s.id)));
    });
  }, [enrollments, sheets, sheet, sessions, cells]);

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

  /**
   * المغادرون المعروضون — بشرطين لا بواحد.
   *
   * الأوّل: **كشفُ المغادرة** — فيه يُقال إنّه غادر، ولولا هذا القيد
   * لظهر من نُقل في مارس على رأس كشف جانفي إلى آخر السنة.
   *
   * والثاني: **كلُّ كشفٍ له فيه علامة**. وهو ما كان ناقصاً: الطالب
   * درس في الفوج شهوراً ثمّ غادر في الأخير، فكان تاريخُه كلُّه يختفي
   * من كشوفه وتبقى ورقةٌ فيها ثمانِ حصصٍ لأحدَ عشر طالباً بلا تفسير
   * لمن كان الثاني عشر. والأستاذ يُخلَّص على تلك العلامات، فحقُّه أن
   * يراها.
   */
  const shownDeparted = useMemo(() => {
    const term = search.trim();

    return departed.filter((row) => {
      if (term && !fullName(row.student).includes(term)) return false;

      return (
        row.transferSheetId === sheetId ||
        sessions.some((s) => cells.has(cellKey(row.id, s.id)))
      );
    });
  }, [departed, sheetId, search, sessions, cells]);

  /**
   * أهذه الحصةُ من حصصه؟ — والنقلُ يقسم الكشف قسمين.
   *
   * المغادِرُ مسؤولٌ عمّا وقع **إلى** يوم نقله، والوافدُ عمّا وقع
   * **منه**. ومن لا نقلَ له فالكشفُ كلُّه له.
   *
   * والمقارنة باليوم لا باللحظة، كما في `isEligibleFor` على الخادم:
   * من نُقل صباح يوم الحصة أخذ حصةَ ذلك اليوم في فوجه الجديد.
   */
  const ownsSession = (row: EnrollmentRow, sessionDate: string) => {
    /*
      المؤجَّلُ لم يُنقل بعد — فالكشفُ كلُّه له.

      ولولا هذا الاستثناء لطُويت خاناتُه من يوم القرار، وهو ما زال
      يحضر ويُدوَّن له ويُفوتَر شهرَه هنا كاملاً. والتأجيلُ إنّما وُضع
      ليبقى سطرُه كاملاً لا لينقص.
    */
    if (row.pendingTransferToId) return true;
    if (!row.transferAt) return true;

    const at = isoDate(sessionDate);
    const on = isoDate(row.transferAt);

    return row.isActive ? at >= on : at <= on;
  };

  /**
   * حصصُ صفٍّ منقولٍ في هذا الكشف — محضورُها ومجموعُها.
   *
   * والمقام حصصُه هو لا حصصُ الكشف: كشفٌ ثمانِ حصصٍ غادر بعد خمسٍ
   * يُقرأ «0 / 5» لا «0 / 8» — فيلتقي مع ملاحظته «درس هنا 5 من 8
   * حصص»، ولا يُنسب إليه ما لم يكن في الفوج يومه.
   *
   * وكان العمود يجمع الاثنين فيخرج «3 / 8» لمن غاب عن حصصه الخمس
   * كلِّها، وثلاثتُه من حصصٍ تلت رحيله.
   */
  const transferTally = (row: EnrollmentRow) => {
    const mine = held.filter((s) => ownsSession(row, s.sessionDate));

    return {
      attended: mine.filter((s) => {
        const record = cells.get(cellKey(row.id, s.id));
        return record ? isAttended(record.status) : false;
      }).length,
      of: mine.length,
    };
  };

  /** إلغاءُ نقلٍ مؤجَّل — قرارٌ يُراجَع قبل أن يسري */
  const cancelPending = async (row: EnrollmentRow) => {
    setBusyKey(row.id);
    setError(null);

    try {
      await cancelPendingTransfer(row.id);
      await loadSheet();
      flash("أُلغي النقل المؤجَّل — يبقى الطالب في فوجه");
    } catch (err: any) {
      fail(err, "تعذّر إلغاء النقل المؤجَّل");
    } finally {
      setBusyKey(null);
    }
  };

  /**
   * الانتقال من ملاحظة النقل إلى الطرف الآخر.
   *
   * الملاحظة تقول «مُنقَل من الفوج 1 · كشف الشهر 7» فيريد قارئُها أن
   * يفتحه — وكان عليه أن يعود ويعيد اختيار الطور والمستوى والمادة
   * والأستاذ والفوج ثمّ يبحث عن الكشف. والمقصدُ محفوظٌ في الصفّ،
   * فيكفيه ضغطة.
   *
   * والمُمرَّر `transferPeerSheetId` — كشفُ **الفوج المقصود** في شهر
   * النقل. وكان يُمرَّر كشفُ هذا الفوج، وهو ليس من كشوف ذاك، فيسقط
   * الاختيار ويُفتح كشفُه الافتراضيّ: شهرٌ لا صلة له بالنقل.
   *
   * والاسمُ يُمرَّر معه فيقع بصرُ القارئ على السطر بلا بحث.
   */
  const jumpToPeer = (row: EnrollmentRow) => {
    if (!row.transferPeerAssignmentId) return;

    const query = new URLSearchParams({
      y: yearId,
      a: row.transferPeerAssignmentId,
      /* `fullName` نفسُها التي يُقارن بها التوهّج — وإلّا فرَّقت مسافةٌ زائدة */
      q: fullName(row.student),
    });

    if (row.transferPeerSheetId) query.set("s", row.transferPeerSheetId);

    navigate(`${PATHS.attendanceDaily}?${query.toString()}`);
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

  /**
   * «لا شيء» — الخانة تعود كما وُلدت: فارغةً لا غياباً.
   *
   * الحالاتُ الأربع كلُّها تدوين، وليس فيها ما يُلغي التدوين نفسه.
   * فمن ضغط سهواً على صفّ طالبٍ لم يكن أمامه لم يجد إلّا أن يجعله
   * «غائباً» — فيبقى في سجلّه غيابٌ لم يقع، ويدخل الكشفَ والتخليص.
   */
  const clearStatus = async (enrollmentId: string, sessionId: string) => {
    const key = cellKey(enrollmentId, sessionId);
    const existing = cells.get(key);

    setPicker(null);
    if (!existing) return;

    /* تفرغ الآن؛ والارتداد يُعيد ما كان بالضبط */
    setCells((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

    /* ما لم يصل الخادمَ بعد لا يُحذف منه — إسقاطُه محلّياً يكفي */
    if (existing.id.startsWith("tmp:")) return;

    setBusyKey(key);

    try {
      await deleteAttendance(existing.id);
    } catch (err: any) {
      setCells((prev) => new Map(prev).set(key, existing));
      fail(
        err,
        err?.response?.status === 403
          ? "لا صلاحية لمحو الحضور."
          : "تعذّر إفراغ الخانة",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const markColumnPresent = async (sessionId: string) => {
    /* أهلُ الكشف لا كلُّ الإسناد — ولا يُدوَّن حضورٌ لمن ليس في الورقة */
    if (roster.length === 0) return;

    const before = new Map(cells);

    setCells((prev) => {
      const next = new Map(prev);
      for (const e of roster) {
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
        records: roster.map((e) => ({
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

  /** ما يبقى مقروءاً حين يُطوى لوح المرشِّحات */
  const chips = useMemo<FilterChip[]>(() => {
    const year = years.find((y) => y.id === yearId);

    return [
      ...(year ? [{ label: "السنة", value: year.name }] : []),
      ...filterSummary(options, filters),
      ...(sheet ? [{ label: "الكشف", value: sheetTitle(sheet) }] : []),
    ];
  }, [years, yearId, options, filters, sheet]);

  /**
   * صفوفُ العرض — مصفّاةً بالبحث ومحتفظةً بترتيبها الأصلي.
   *
   * الترتيب رقمُ الطالب في الكشف لا موضعُه في نتيجة البحث: من بحث عن
   * «بلقاسم» فوجده الثالثَ عشرَ يقرأ الرقم نفسه في الورقة المطبوعة.
   */
  const visible = useMemo(
    () =>
      roster
        .map((enrollment, index) => ({ enrollment, order: index + 1 }))
        .filter((row) => matchesQuery(fullName(row.enrollment.student), search)),
    [roster, search],
  );

  /*
   * إطفاءُ التوهّج — والعدُّ يبدأ حين يظهر السطر لا حين يُقرأ الرابط.
   *
   * الشاشة تُحمّل الإسنادات ثمّ الكشوف ثمّ المسجَّلين، وبين النقرة
   * ورسم الصفّ ثوانٍ. فلو بدأ المؤقّت مع الرابط لانطفأ التوهّجُ قبل
   * أن يُرسَم ما يتوهّج، ووصل القارئ إلى ورقةٍ ساكنة.
   */
  useEffect(() => {
    if (!glowFor) return;

    const drawn =
      visible.some((row) => fullName(row.enrollment.student) === glowFor) ||
      shownDeparted.some((row) => fullName(row.student) === glowFor);

    if (!drawn) return;

    /*
     * ويُمرَّر إليه الجدول: الكشف يطول فيخرج السطر عن الشاشة، ولا
     * ينفع توهّجٌ تحت الطيّة. و`inline: nearest` تمنع الانزلاق
     * الأفقيّ — الجدول يمتدّ ثمانيَ حصصٍ يميناً، ولا شأن للتمرير
     * الرأسيّ بموضع الأعمدة.
     */
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    glowRow.current?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: still ? "auto" : "smooth",
    });

    const timer = setTimeout(() => setGlowFor(null), GLOW_MS);
    return () => clearTimeout(timer);
  }, [glowFor, visible, shownDeparted]);

  /**
   * أيُعرض خبرُ النقل في هذا الكشف؟
   *
   * المؤجَّلُ خبرُ **مستقبل**، فيُعرض أيّاً كان الكشفُ المفتوح: به يعلم
   * الموظّف أنّ الطالب سيغادر عند طيّ الورقة، وفيه زرُّ الإلغاء.
   *
   * والواقعُ خبرُ ماضٍ يخصّ ورقةً بعينها — الكشفَ الذي وقع فيه. وكان
   * يتكرّر في كلّ كشفٍ يُفتح بعده، فيحمل عمودُ الملاحظات إلى آخر السنة
   * «مُنقَل من الفوج 2 — 21/08» وقد عُلم وانقضى، يزاحم ما يُكتب اليوم.
   * والورقةُ الجديدة تبدأ نظيفة: من فيها فيها، ولا يُعاد خبرُ وصوله.
   */
  const showsTransferNote = (row: {
    pendingTransferToId: string | null;
    transferSheetId: string | null;
  }) => Boolean(row.pendingTransferToId) || row.transferSheetId === sheetId;

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
        <FilterPanel
          accent={ACCENT}
          storageKey="attendance.daily"
          collapseKey={assignment?.id ?? ""}
          busy={loadingRefs}
          chips={chips}
          extra={
            <SheetScanner sheets={sheets} onFound={jumpTo} busy={jumping} accent={ACCENT} />
          }
          onReset={() => setFilters(EMPTY_FILTERS)}
        >
          <FilterField label="السنة الدراسية">
            <FilterSelect value={yearId} onChange={setYearId} items={years} accent={ACCENT} />
          </FilterField>

          <FilterField label="الطور">
            <FilterSelect
              value={filters.stageId}
              onChange={(v) => setFilter("stageId", v)}
              items={options.stages}
              placeholder="كل الأطوار"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="المستوى">
            <FilterSelect
              value={filters.levelId}
              onChange={(v) => setFilter("levelId", v)}
              items={options.levels}
              placeholder="كل المستويات"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="المادة">
            <FilterSelect
              value={filters.subjectId}
              onChange={(v) => setFilter("subjectId", v)}
              items={options.subjects}
              placeholder="اختر المادة"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الأستاذ">
            <FilterSelect
              value={filters.teacherId}
              onChange={(v) => setFilter("teacherId", v)}
              items={options.teachers.map((t) => ({ id: t.id, name: fullName(t) }))}
              placeholder="اختر الأستاذ"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الفوج">
            <FilterSelect
              value={filters.groupId}
              onChange={(v) => setFilter("groupId", v)}
              items={options.groups}
              placeholder="اختر الفوج"
              accent={ACCENT}
            />
          </FilterField>

          {/* الكشف بدل الشهر: وحدةٌ إدارية لا مدىً تقويمي */}
          {ready && (
            <FilterField label="الكشف" span>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <FilterSelect
                    value={sheetId}
                    onChange={setSheetId}
                    items={sheets.map((s) => ({ id: s.id, name: sheetTitle(s) }))}
                    placeholder={sheets.length === 0 ? "لا كشوف بعد" : undefined}
                    disabled={sheets.length === 0}
                    accent={ACCENT}
                  />
                </div>

                {can("attendance.create") && (
                  <button
                    onClick={() => setNewOpen(true)}
                    disabled={noSchedule}
                    title={noSchedule ? "لا خانة في الجدول الأسبوعي لهذا الإسناد" : "كشف جديد"}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black text-[#241202] transition hover:brightness-110 disabled:opacity-35"
                    style={{ background: ACCENT }}
                  >
                    <FilePlus2 className="h-4 w-4" />
                    كشف جديد
                  </button>
                )}
              </div>
            </FilterField>
          )}
        </FilterPanel>

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
                /*
                  الورقة تُطبع ولو خلا الكشف.

                  هذا **أصلُ استعمالها** لا حالةٌ شاذّة: تخرج فارغةً
                  بأعمدةٍ بعدد ما قرّرته المؤسسة، فتُسلَّم للأستاذ يدوّن
                  فيها الحضور بالقلم، ثمّ تعود إلى الإدارة فتُنقل إلى
                  الكشف. وكان الزرّ يُعطَّل حتى تُنشأ أوّلُ حصة — أي حتى
                  يُدوَّن ما جاءت الورقة لتُدوَّن فيه.
                */
                disabled={!hasSheet}
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
            {/* شريط البحث — فوق الجدول لا داخل المرشِّحات: يبقى ظاهراً ولو طُويت */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <SearchBox
                value={search}
                onChange={setSearch}
                shown={visible.length}
                total={roster.length}
                accent={ACCENT}
              />

              <span className="text-[11px] text-white/35">
                {roster.length} مسجَّلاً في هذا الكشف
              </span>
            </div>

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
                  {visible.length === 0 && shownDeparted.length === 0 && (
                    <tr>
                      {/* عمودان ثابتان + الحصص + الخانات الفارغة + خمسة أعمدةٍ في الذيل */}
                      <td
                        colSpan={sessions.length + emptySlots + 7}
                        className="px-4 py-14 text-center text-sm text-white/40"
                      >
                        لا طالب باسم «{search.trim()}» في هذا الكشف
                      </td>
                    </tr>
                  )}

                  {visible.map(({ enrollment: e, order }) => {
                    /* لا تُسمَّ `window`: ظِلٌّ على الكائن العامّ في هذا الحيّز */
                    const own = e.transferAt ? transferTally(e) : null;
                    const total = own ? own.attended : presentCount(e.id);
                    const denominator = own ? own.of : held.length;
                    const dirty = pendingNotes.has(e.student.id);
                    const fee = feeOf(e.id);

                    return (
                      <tr
                        key={e.id}
                        ref={glowFor === fullName(e.student) ? glowRow : undefined}
                        className={`transition hover:bg-white/[0.03]${
                          glowFor === fullName(e.student) ? " skk-row-glow" : ""
                        }`}
                      >
                        <td
                          className="sticky z-10 border-b border-e border-white/5 bg-[#070b14] px-2 py-1.5 text-center text-white/45"
                          style={{ insetInlineStart: 0 }}
                        >
                          {order}
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
                          /*
                            ما قبل التحاق المنقول ليس خانتَه.

                            الوافدُ في الحصة الرابعة لم يغب عن الثلاث
                            الأولى: لم يكن في الفوج. وكانت تُعرض له
                            خاناتٌ فارغةٌ تُنقر فتُدوَّن — ويُقرأ مقامُه
                            «من 8» وحصصُه خمس.
                          */
                          const mine = ownsSession(e, s.sessionDate);
                          const record = mine ? cells.get(key) : undefined;
                          const tone = record ? STATUS_TONE[record.status] : null;

                          if (!mine) {
                            return (
                              <td key={s.id} className="border-b border-e border-white/5 p-0 text-center">
                                <span
                                  className="grid h-9 w-full place-items-center text-white/10"
                                  title="قبل التحاقه بالفوج — ليست من حصصه"
                                >
                                  —
                                </span>
                              </td>
                            );
                          }

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

                        <td
                          className="border-b border-e border-white/5 px-2 py-1.5 text-center"
                          title={
                            own
                              ? `حضر ${total} من ${denominator} حصصٍ أُجريت له بعد التحاقه. ` +
                                "والحقّ يُحسب على ما أُجري له لا على ما حضره."
                              : undefined
                          }
                        >
                          <span className="font-black" style={{ color: ACCENT }}>{total}</span>
                          {/*
                            المقام المنجزة لا كل الأعمدة — وإلّا بدا الحاضرُ
                            في كلّها ناقصاً. ومن نُقل فمقامُه حصصُه هو.
                          */}
                          <span className="text-white/25"> / {denominator}</span>
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
                          {/*
                            خبرُ النقل فوق الحقل لا داخله: الحقل ملكُ
                            الموظّف يكتب فيه ويمحو، وهذا خبرٌ لا يُمحى
                            ولا يُطمس عليه ما كتب.
                          */}
                          {e.note && showsTransferNote(e) && (
                            <span className="mb-1 flex items-start gap-1">
                              {/*
                                لونان لا لون: الكهرمانيُّ لما **سيكون**
                                (نقلٌ قُرِّر ولم يسرِ)، ولونُ الشاشة لما
                                كان. ولو اتّحدا لقرأ الموظّفُ خبرَ
                                المستقبل ماضياً وظنّ الطالب قد غادر.
                              */}
                              <span
                                className="min-w-0 flex-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                                title={e.note}
                                style={
                                  e.pendingTransferToId
                                    ? { background: "rgba(251,191,36,0.14)", color: "#fbbf24" }
                                    : { background: `${ACCENT}1a`, color: ACCENT }
                                }
                              >
                                {e.note}
                              </span>

                              {e.pendingTransferToId ? (
                                editable && (
                                  <button
                                    onClick={() => cancelPending(e)}
                                    disabled={busyKey === e.id}
                                    title="ألغِ النقل المؤجَّل — يبقى الطالب في فوجه"
                                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-amber-300 transition hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-40"
                                    style={{ background: "rgba(251,191,36,0.18)" }}
                                  >
                                    {busyKey === e.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <X className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )
                              ) : (
                                e.transferPeerAssignmentId && (
                                  <button
                                    onClick={() => jumpToPeer(e)}
                                    title="افتح الكشف الذي جاء منه"
                                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md transition hover:brightness-125"
                                    style={{ background: `${ACCENT}2e`, color: ACCENT }}
                                  >
                                    <ArrowUpLeft className="h-3.5 w-3.5" />
                                  </button>
                                )
                              )}
                            </span>
                          )}

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

                  {/*
                    المغادرون — سطرٌ باهتٌ لا يدخل حساباً.

                    خانات الحصص مطويّةٌ في خانةٍ واحدة عمداً: لا حضورَ
                    يُدوَّن لمن غادر، وخاناتٌ فارغةٌ قابلةٌ للنقر تدعو
                    إلى تدوينٍ لا يجوز. وأعمدةُ المال شُرَطٌ لأنّ
                    فاتورته معلَّقةٌ بفوجه الجديد لا بهذا.
                  */}
                  {shownDeparted.map((row) => (
                    <tr
                      key={row.id}
                      ref={glowFor === fullName(row.student) ? glowRow : undefined}
                      className={`bg-white/[0.015] text-white/45${
                        glowFor === fullName(row.student) ? " skk-row-glow" : ""
                      }`}
                    >
                      <td
                        className="sticky z-10 border-b border-e border-white/5 bg-[#070b14] px-2 py-1.5 text-center text-white/25"
                        style={{ insetInlineStart: 0 }}
                      >
                        —
                      </td>
                      <td
                        className="sticky z-10 truncate border-b border-e border-white/5 bg-[#070b14] px-3 py-1.5 font-bold text-white/45 line-through decoration-white/20"
                        style={{ insetInlineStart: 54 }}
                        title={fullName(row.student)}
                      >
                        {fullName(row.student)}
                      </td>

                      {/*
                        حضورُه قبل أن يغادر — يُعرض ولا يُعدَّل.

                        وما بعد يوم النقل ليس له: كانت الخانة تعرض ما
                        وُجد فيها من علامات — وهي علاماتُ حصصٍ تلت
                        رحيله — فيخرج «3 / 8» بجانب ملاحظةٍ تقول «درس
                        هنا 5 من 8». رقمان في سطرٍ واحد لا يلتقيان.
                        فتُشطب تلك الخانات ولا تُعدّ.
                      */}
                      {sessions.map((s) => {
                        const mine = ownsSession(row, s.sessionDate);
                        const record = mine ? cells.get(cellKey(row.id, s.id)) : undefined;
                        const tone = record ? STATUS_TONE[record.status] : null;

                        return (
                          <td key={s.id} className="border-b border-e border-white/5 p-0 text-center">
                            <span
                              className="grid h-9 w-full place-items-center text-base font-black opacity-60"
                              style={tone ? { background: tone.bg, color: tone.fg } : undefined}
                              title={
                                !mine
                                  ? "بعد مغادرته — ليست من حصصه"
                                  : tone
                                    ? `${tone.label} — قبل النقل`
                                    : "لم يُسجَّل"
                              }
                            >
                              {!mine ? (
                                <span className="text-white/10">—</span>
                              ) : tone ? (
                                tone.short
                              ) : (
                                <span className="text-white/10">·</span>
                              )}
                            </span>
                          </td>
                        );
                      })}

                      {Array.from({ length: emptySlots }).map((_, i) => (
                        <td
                          key={`d-empty-${i}`}
                          className="border-b border-e border-white/5 bg-white/[0.015] p-0 text-center"
                        >
                          <span className="grid h-9 w-full place-items-center text-white/10">—</span>
                        </td>
                      ))}

                      {/* المقام حصصُه هو لا حصصُ الكشف — وإلّا نُسب إليه ما لم يحضره */}
                      <td
                        className="border-b border-e border-white/5 px-2 py-1.5 text-center"
                        title={
                          `حضر ${transferTally(row).attended} من ${transferTally(row).of} ` +
                          "حصصٍ أُجريت له قبل نقله. " +
                          "والحقّ يُحسب على ما أُجري له لا على ما حضره — الغياب لا يُنقص شيئاً."
                        }
                      >
                        <span className="font-black text-white/45">{transferTally(row).attended}</span>
                        <span className="text-white/20"> / {transferTally(row).of}</span>
                      </td>

                      {/* المال معلَّقٌ بفوجه الجديد لا بهذا — فشُرَطٌ لا أرقام */}
                      <td className="border-b border-e border-white/5 px-2 py-1.5 text-center text-white/25">—</td>
                      <td className="border-b border-e border-white/5 px-2 py-1.5 text-center text-white/25">—</td>

                      <td className="border-b border-e border-white/5 px-1.5 py-1">
                        <span className="flex items-start gap-1">
                          <span
                            className="min-w-0 flex-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                            title={row.note ?? ""}
                            style={{ background: `${ACCENT}1a`, color: ACCENT }}
                          >
                            {row.note}
                          </span>

                          {row.transferPeerAssignmentId && (
                            <button
                              onClick={() => jumpToPeer(row)}
                              title="افتح كشف الفوج الذي نُقل إليه"
                              className="grid h-5 w-5 shrink-0 place-items-center rounded-md transition hover:brightness-125"
                              style={{ background: `${ACCENT}2e`, color: ACCENT }}
                            >
                              <ArrowUpLeft className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </td>

                      <td
                        className="sticky z-10 border-b border-white/5 bg-[#070b14] px-2 py-1.5 text-center"
                        style={{ insetInlineEnd: 0 }}
                      >
                        <span
                          className="inline-block rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-bold text-white/40"
                          title={
                            row.transferSheetId === sheetId
                              ? "غادر الفوج في أثناء هذا الكشف"
                              : "كان في الفوج حين هذا الكشف ثمّ غادره لاحقاً"
                          }
                        >
                          غادر
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/40">
              <span>
                {roster.length} طالباً · {sessions.length} حصة مؤرَّخة
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
              /* خمسةُ صفوفٍ وفاصل — والحدُّ يتبع الارتفاع وإلّا خرج آخرُها */
              top: Math.min(picker.y + 6, window.innerHeight - 246),
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

            {/*
              الخامس ليس حالةً بل نفيُها — ولذلك هو خارج `STATUS_TONE`.
              إدخالُه فيها كان يُدخله في الشريط المفسِّر وفي الورقة
              المطبوعة، وهو لا يُطبع: الفارغُ يُقرأ فراغاً.
            */}
            <div className="my-1 h-px bg-white/10" />

            <button
              onClick={() => clearStatus(picker.enrollmentId, picker.sessionId)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-bold transition hover:bg-white/10"
              style={
                cells.get(cellKey(picker.enrollmentId, picker.sessionId))
                  ? undefined
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }
              }
            >
              <span
                className="grid h-5 w-5 place-items-center rounded text-[11px] font-black"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
              >
                −
              </span>
              لا شيء
              {!cells.get(cellKey(picker.enrollmentId, picker.sessionId)) && (
                <Check className="ms-auto h-3.5 w-3.5" />
              )}
            </button>
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
      {/* بلا شرطِ حصة: الورقة الفارغة هي التي تُرسل إلى الأستاذ ليملأها */}
      {previewing && hasSheet && sheet && (
        <SheetPreview
          title="كشف الحضور اليومي"
          subtitle={`${assignment!.subject.name} · ${assignment!.studyGroup.level.name} · ${assignment!.studyGroup.name} · ${sheetTitle(sheet)}`}
          warning={printWarning}
          onRefresh={loadSheet}
          onClose={() => setPreviewing(false)}
        >
          <SheetPrint
            schoolName={schoolName}
            assignment={assignment!}
            title={sheetTitle(sheet)}
            sessions={sessions}
            columnCount={columnCount}
            enrollments={roster}
            cells={cells}
            notes={notes}
            invoices={invoices}
            code={sheetCode(sheet)}
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

/* الحقول والقوائم انتقلت إلى components/shared/FilterPanel — لوحٌ واحد للكشوف الثلاثة */

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

/**
 * الحدُّ الأدنى لسطور الورقة — 25 كما في الأصل الورقي.
 *
 * وهو **حدٌّ أدنى لا سعةٌ نهائية**: السعة تُقاس بعد الرسم، لأنّ ارتفاع
 * الصفّ يتعلّق بملاحظةٍ يكتبها الموظّف فتلتفّ سطرين. انظر
 * `usePagedRows` في `components/print/paged-sheet`.
 */
const PRINT_ROWS_PER_PAGE = 25;

/**
 * أعرضُ الأعمدة الثابتة بالنسبة المئوية — وما بقي فلأعمدة الحصص.
 *
 * مكتوبةٌ هنا لا في الوسم لأنّ حساب مقاس خطّ التاريخ يحتاجها: عرضُ خانة
 * الحصة هو الباقي مقسوماً على عددها.
 */
const COLUMN_PERCENT = { order: 5, name: 24, total: 8, note: 17 } as const;

const DATES_SHARE =
  100 - (COLUMN_PERCENT.order + COLUMN_PERCENT.name + COLUMN_PERCENT.total + COLUMN_PERCENT.note);

/** حشوة الخانة يمنةً ويسرة كما في `index.css` */
const CELL_PADDING_MM = 1.4;

/**
 * عرضُ التاريخ بأمثال مقاس خطّه — مقيسٌ لا مقدَّر.
 *
 * «28/08/2026» يشغل 5.485 أمثال المقاس، و«28/08/26» يشغل 4.335. ومنهما
 * يُشتقّ أكبرُ خطٍّ يسع الخانة بلا كسرِ السطر.
 */
const DATE_WIDTH = { long: 5.485, short: 4.335 } as const;

/**
 * الورقة المطبوعة.
 *
 * التقسيم إلى صفحاتٍ صريح لا متروكٌ للمتصفّح: الترقيم «الصفحة 1 من 2»
 * لا يمكن حسابه في CSS (‏Chromium لا يدعم صناديق هوامش `@page`)، فلو
 * تُرك التقطيع للمتصفّح لتعذّر ترقيمُها. وحين نقطّعها بأنفسنا تُعرف
 * الصفحاتُ عدداً وترتيباً، وتتكرّر الترويسة كاملةً على كل ورقة.
 *
 * وعددُ الصفوف في الورقة **يُقاس ولا يُفترض**: كان 25 صفّاً محسوبةً على
 * صفٍّ من سطرٍ واحد، فإذا التفّت الملاحظات سطرين خرجت آخرُ الصفوف خارج
 * الورقة. فتُرسم الصفوف كلُّها مرّةً في ورقةٍ خفيّة وتُقاس، ثمّ تُوزَّع
 * بارتفاعها الحقيقي — وما يسع ورقةً واحدة يبقى في واحدة.
 */
function SheetPrint({
  schoolName,
  assignment,
  title,
  sessions,
  columnCount,
  enrollments,
  cells,
  notes,
  invoices,
  code,
  logo,
}: {
  schoolName: string;
  assignment: Assignment;
  title: string;
  sessions: SheetSession[];
  /** أعمدةُ الكشف كما قرّرتها المؤسسة — ما لم تُنشأ حصّتُه يخرج فارغاً */
  columnCount: number;
  enrollments: EnrollmentRow[];
  cells: Map<string, AttendanceRow>;
  notes: Map<string, string>;
  invoices: Map<string, Invoice>;
  /** رمزُ الكشف — يخرج باركوداً تحت سطر التحرير */
  code: string;
  logo: LogoSpec;
}) {
  const printedOn = printedStamp();

  /*
   * الأعمدة كلّها تُطبع — المجدولة والملغاة معها، فالورقة تُظهر ما في
   * الكشف كما هو. والعدّ وحده يقتصر على المنجزة.
   */
  const held = heldSessions(sessions);

  /*
   * أعمدةُ الورقة: ما أُنشئ من حصص، مكمَّلاً إلى ما قرّرته المؤسسة.
   *
   * الكشف يفتح أعمدةً بعددٍ معلوم، وتُكتب تواريخُها واحداً بعد آخر. وكان
   * المطبوع يعرض ما كُتب تاريخُه فقط — فالورقة التي تُرسل إلى الأستاذ
   * ليملأها تخرج بلا خانةٍ يملؤها. فما بقي يخرج عموداً فارغاً مرقَّماً.
   */
  const printedColumns = Math.max(sessions.length, columnCount);
  const spareColumns = printedColumns - sessions.length;

  /*
   * ورقةٌ فارغة — لا حضورَ فيها أصلاً.
   *
   * فلا مجموعَ يُكتب (صفرٌ في كلّ سطر يوهم أنّ الحضور دُوِّن ولم يحضر
   * أحد)، ولا ملاحظاتٍ ولا «مخلف»: الورقة ذاهبةٌ إلى الأستاذ ليكتب
   * فيها، لا آتيةٌ منه.
   */
  const blankForm = cells.size === 0;

  /*
   * الشعار على الورقة أكبر منه على الإيصال: الإيصال شريطٌ عرضه 80mm
   * والورقة 297mm، فقياسٌ واحد يخدم أحدهما ويضيع في الآخر.
   */
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));

  /*
   * المخزون: المسجَّلون ثمّ فراغاتٌ تكفي لملء آخر ورقة مهما كانت سعتها.
   * وما فاض منها يُسقط بعد التقسيم فلا تخرج ورقةٌ لا تحمل إلّا أرقاماً.
   */
  const stock = enrollments.length + PRINT_ROWS_PER_PAGE;

  /* بصمةُ ما يغيّر الارتفاعات: الحصص، والأسماء، والملاحظات، و«مخلف» */
  const signature = [
    printedColumns,
    blankForm,
    enrollments
      .map(
        (e) =>
          `${e.student.id}:${e.note ?? ""}:${notes.get(e.student.id) ?? ""}:` +
          `${invoices.get(e.id)?.remaining ?? 0}`,
      )
      .join(","),
  ].join("|");

  const { measureRef, pages } = usePagedRows(signature, {
    rowCount: stock,
    perPage: PRINT_ROWS_PER_PAGE,
  });

  /*
    ترويسةٌ ثلاثية المناطق كما في الورقة: المستوى والكشف يميناً، وهوية
    المؤسسة وعنوان الوثيقة وسطاً، والمادة والفوج والأستاذ يساراً.
    والشعار وحده زيادةٌ على الأصل. وتتكرّر على كل ورقة كاملةً — من حمل
    الورقة الثانية وحدها يجب أن يعرف لِمَن هي.
  */
  const header = (
    <header className="sheet-print-top">
      <div className="sheet-print-side">
        <span>المستوى: {assignment.studyGroup.level.name}</span>
        <span>{title}</span>
        <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
        <SheetBarcode code={code} />
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
  );

  /*
   * خانةُ التاريخ ومقاسُ خطّها.
   *
   * أعمدةُ الحصص تقتسم ما تبقّى من عرض الورقة، فكلّما زادت ضاقت خانتُها.
   * وكان الخطّ ثابتاً 2.7mm فينكسر التاريخ سطرين عند ثماني حصص، ويصير
   * «25/08/202» و«6» تحته.
   *
   * فالمقاس يُحسب: عرضُ الخانة بالمليمتر ÷ ما يشغله «28/08/2026» في
   * مقاسٍ معلوم (‏قِيس: 5.49 أمثال مقاس الخطّ)، مع فسحةٍ 8% للحدود.
   * وإذا ضاق حتى عن أصغرِ مقاسٍ يُقرأ، طُرح القرن من السنة — وهو في
   * ترويسة الورقة كاملاً.
   */
  const dateRoomMm =
    (((SHEET_MM.width - 2 * SHEET_MM.padding) * (DATES_SHARE / 100)) / Math.max(1, printedColumns) -
      CELL_PADDING_MM) *
    0.94;

  const longFont = dateRoomMm / DATE_WIDTH.long;
  const shortYear = longFont < 2.1;

  const dateFont = Math.min(
    2.6,
    Math.max(1.5, shortYear ? dateRoomMm / DATE_WIDTH.short : longFont),
  );

  /*
    الورقة ورقةُ حضورٍ لا ورقةُ مال.

    كان المطبوع يحمل «الحقّ الشهري» و«الدَّين» كما تحملهما الشاشة، وهما
    على الشاشة خبرٌ يُقرأ بجانب الحضور. لكنّ الورقة تُحمل إلى القاعة
    وتُترك على الطاولة وتُصوَّر — فمبلغُ كلِّ طالبٍ ودَينُه يخرجان من
    المكتب مطبوعين، وليس ذلك ما تُطبع الورقة لأجله.

    و«مخلف» تبقى في الملاحظات: هي ما تحمله الورقة الأصلية، تقول إنّ على
    الطالب حقّاً بلا أن تُعلن كم هو. وكشف الحقوق الشهري هو موضع المال.
  */
  const columns = (
    <thead>
      <tr>
        <th rowSpan={3} style={{ width: `${COLUMN_PERCENT.order}%` }}>الترتيب</th>
        <th rowSpan={3} style={{ width: `${COLUMN_PERCENT.name}%` }}>اسم ولقب الطالب</th>
        <th colSpan={printedColumns}>تاريخ الحضور</th>
        <th rowSpan={3} style={{ width: `${COLUMN_PERCENT.total}%` }}>مجموع عدد الحصص</th>
        <th rowSpan={3} style={{ width: `${COLUMN_PERCENT.note}%` }}>ملاحظــات</th>
      </tr>
      <tr>
        {sessions.map((s) => (
          <th
            key={s.id}
            className="sheet-print-date"
            style={{ fontSize: `${dateFont.toFixed(2)}mm` }}
          >
            {shortYear ? sheetDateShort(s.sessionDate) : sheetDate(s.sessionDate)}
          </th>
        ))}

        {/* عمودٌ لم تُكتب حصّتُه بعد — ترويسةٌ فارغة يملؤها الأستاذ بالقلم */}
        {Array.from({ length: spareColumns }, (_, i) => (
          <th key={`spare-date-${i}`} className="sheet-print-date" />
        ))}
      </tr>
      <tr>
        {Array.from({ length: printedColumns }, (_, i) => (
          <th key={`slot-${i}`}>الحصة {i + 1}</th>
        ))}
      </tr>
    </thead>
  );

  const bodyRow = (index: number) => {
    const e = enrollments[index];

    if (!e) {
      /* صفٌّ مرقَّم فارغ — الورقة تُطبع كاملةً وتُملأ بالقلم */
      return (
        <tr key={`blank-${index}`}>
          <td className="c">{index + 1}</td>
          <td />
          {Array.from({ length: printedColumns }, (_, column) => (
            <td key={`cell-${column}`} />
          ))}
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
     * كانت تُكتب باليد فتُنسى أو تبقى بعد السداد. ومصدرُها هنا
     * `Invoice.remaining`، فتظهر بظهور الدَّين وتزول بزواله بلا خطوةٍ
     * ثانية. وملاحظةُ الموظّف تبقى بجانبها لا تُمحى.
     */
    const remark = [debt > 0 ? "مخلف" : "", e.note ?? "", note]
      .filter(Boolean)
      .join(" — ");

    return (
      <tr key={e.id}>
        <td className="c">{index + 1}</td>
        <td className="n">{fullName(e.student)}</td>
        {sessions.map((s) => {
          const record = cells.get(cellKey(e.id, s.id));
          return (
            <td key={s.id} className="c">
              {record ? STATUS_TONE[record.status].short : ""}
            </td>
          );
        })}

        {Array.from({ length: spareColumns }, (_, column) => (
          <td key={`spare-${column}`} />
        ))}

        <td className="c b">{blankForm ? "" : total}</td>
        <td>{blankForm ? "" : remark}</td>
      </tr>
    );
  };

  /*
   * طورُ القياس — ورقةٌ واحدة خفيّة بكلّ الصفوف.
   *
   * لا تُطبع ولا تُرى ولا تُزيح شيئاً (‏`.sheet-measure` في index.css)،
   * ولا تحمل صنف `.sheet-page` فلا تعدّها المعاينة ورقةً.
   */
  if (!pages) {
    return (
      <div className="sheet-print" dir="rtl">
        <div className="sheet-measure" ref={measureRef}>
          <section className="sheet-measure-page" data-measure-page="">
            {header}

            <table className="sheet-print-table">
              {columns}
              <tbody>{Array.from({ length: stock }, (_, index) => bodyRow(index))}</tbody>
            </table>

            <footer className="sheet-print-foot" data-measure-foot="">
              الصفحة 1 من 1
            </footer>
          </section>
        </div>
      </div>
    );
  }

  const sheets = dropBlankPages(pages, enrollments.length);

  return (
    <div className="sheet-print" dir="rtl">
      {sheets.map((rows, page) => (
        <section className="sheet-page" key={page}>
          {header}

          <table className="sheet-print-table">
            {columns}
            <tbody>{rows.map((index) => bodyRow(index))}</tbody>
          </table>

          <footer className="sheet-print-foot">
            {sheets.length > 1 ? `الصفحة ${page + 1} من ${sheets.length}` : "الصفحة 1"}
          </footer>
        </section>
      ))}
    </div>
  );
}
