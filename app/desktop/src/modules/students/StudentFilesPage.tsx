import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderCheck,
  Hash,
  Loader2,
  Printer,
  Search,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { FormDialog } from "../../components/shared/FormDialog";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { BarcodeScanner } from "../../components/shared/BarcodeScanner";
import { PrintPreview } from "../../components/print/PrintPreview";
import { SheetPreview } from "../../components/print/SheetPreview";
import { StudentFilesSheet } from "./StudentFilesSheet";
import { DocumentsPanel } from "./DocumentsPanel";
import { RegistrationFee } from "./RegistrationFeePanel";
import { RegistrationReceiptDoc } from "./RegistrationReceipt";
import { useSchool } from "../../core/stores/school.store";
import { formatMoney, DEFAULT_CURRENCY } from "../../core/utils/money";
import {
  getDocumentTypes,
  getStudentFile,
  listStudents,
  type CatalogueEntry,
  type DocumentType,
  type Pagination,
  type Student,
} from "./student.api";

const ACCENT = "#fcd34d";
const PAGE_SIZE = 15;

/**
 * ملفات الطلبة.
 *
 * تختلف عن «عرض الطلبة» في السؤال الذي تجيب عنه: هناك «من هم الطلبة؟»
 * وهنا «أيّ ملفٍّ ينقصه شيء؟». فالأعمدة وثائق لا هواتف، والترتيب
 * الافتراضي يُظهر الناقص أوّلاً — لأنّ المكتمل لا يحتاج فعلاً.
 */
export default function StudentFilesPage() {
  const exitToHome = useScreenExit();

  const [types, setTypes] = useState<DocumentType[]>([]);
  const [rows, setRows] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  /* حقلٌ ثانٍ للرقم — لا يُخلط بالبحث الحرّ */
  const [number, setNumber] = useState("");
  const [numberQuery, setNumberQuery] = useState("");

  const [status, setStatus] = useState<"" | "true" | "false">("false");
  const [page, setPage] = useState(1);

  /** الوصلُ المعاين — الطالبُ وملفُّه معاً، فالورقة تحتاجهما */
  const [receipt, setReceipt] = useState<{
    student: Student;
    catalogue: CatalogueEntry[];
  } | null>(null);
  const [preparing, setPreparing] = useState<string | null>(null);

  /**
   * كشفُ القائمة — يحمل ما رشّحته الشاشة كلَّه لا صفحتَها الظاهرة.
   *
   * الجدولُ يعرض خمسةَ عشرَ سطراً، والورقةُ تُراجَع كاملةً على الطاولة.
   * فتُجلب المطابقاتُ كلُّها عند فتح المعاينة — مرّةً واحدة، لا مع كلّ
   * تصفّح.
   */
  const [sheetRows, setSheetRows] = useState<Student[] | null>(null);
  const [sheeting, setSheeting] = useState(false);

  const [openStudent, setOpenStudent] = useState<Student | null>(null);

  const currency = useSchool("school.currency") || DEFAULT_CURRENCY;
  const defaultFee = useSchool("school.registration_fee");

  useEffect(() => {
    getDocumentTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  /* مهلةٌ قصيرة: الحرفُ الواحد يكفي للبحث، والانتظارُ الطويل يُبطئه */
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = window.setTimeout(() => setNumberQuery(number.trim()), 250);
    return () => window.clearTimeout(t);
  }, [number]);

  useEffect(() => setPage(1), [debounced, numberQuery, status]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debounced && { search: debounced }),
      ...(numberQuery && { studentNumber: numberQuery }),
      ...(status && { documentsComplete: status === "true" }),
    }),
    [page, debounced, numberQuery, status],
  );

  const fetchRows = async () => {
    setLoading(true);
    setError(null);

    try {
      const { students, pagination: p } = await listStudents(query);
      setRows(students);
      setPagination(p);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر جلب الملفات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /**
   * الوصلُ يحتاج ملفَّ الطالب كاملاً لا أعمدةَ الجدول.
   *
   * الصفُّ يحمل مفاتيح ما رُفع (`documentTypes`) ولا يحمل تسمياتها ولا
   * أيَّها إلزامي — والورقة تعرض الوثائق كلَّها بحالها. فيُجلب الملفّ
   * عند الطلب: طلبٌ واحد لطالبٍ واحد حين تُطلب ورقتُه.
   */
  const openReceipt = async (student: Student) => {
    setPreparing(student.id);
    setError(null);

    try {
      const file = await getStudentFile(student.id);
      setReceipt({ student, catalogue: file.catalogue });
    } catch {
      setError("تعذّر جلب ملف الطالب");
    } finally {
      setPreparing(null);
    }
  };

  /**
   * الكشفُ يُجمع صفحةً صفحة — لا بطلبٍ واحدٍ كبير.
   *
   * الخادم يسقف `limit` عند مئة (‏`studentQuerySchema`)، وطلبُ مئتين
   * يرتدّ بخطأ تحقّقٍ لا بقائمةٍ منقوصة — فيقول «تعذّر تجهيز الكشف»
   * ولا يقول لماذا. فتُطلب المئةُ الأولى ثمّ يُتبَع ما بعدها بما
   * تقوله `totalPages`.
   *
   * وسقفٌ من عشرين صفحة (ألفَي ملفّ) حارسٌ لا حدّ: مؤسسةٌ تتجاوزه
   * تحتاج كشفاً مرشَّحاً لا كشفاً بألفَي سطر، والحلقةُ بلا سقفٍ عطبٌ
   * ينتظر بياناتٍ أكبر.
   */
  const openSheet = async () => {
    setSheeting(true);
    setError(null);

    try {
      const all: Student[] = [];
      let current = 1;
      let pages = 1;

      do {
        const { students, pagination: p } = await listStudents({
          ...query,
          page: current,
          limit: 100,
        });

        all.push(...students);
        pages = p?.totalPages ?? 1;
        current += 1;
      } while (current <= pages && current <= 20);

      setSheetRows(all);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر تجهيز الكشف");
    } finally {
      setSheeting(false);
    }
  };

  const required = types.filter((t) => t.required);

  /** ما رشّحته الشاشة — يُكتب في ترويسة الورقة */
  const scope = [
    status === "true" ? "المكتملة" : status === "false" ? "الناقصة" : "الكلّ",
    debounced && `بحث: ${debounced}`,
    numberQuery && `رقم: ${numberQuery}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="ملفات الطلبة" subtitle="اكتمال الوثائق">
        <button
          onClick={() => exitToHome(PATHS.students)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-325 p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/*
            حقلان لا حقل: الاسمُ يُكتب حروفاً والرقمُ يُكتب خاناتٍ، ولكلٍّ
            مطابقتُه على الخادم. وخلطُهما يجعل «2026» بحثاً عن اسم.
          */}
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="الاسم أو اللقب — حرفٌ واحد يكفي…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-9 ps-10 outline-none transition focus:border-white/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="امسح"
                className="absolute end-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative w-52">
            <Hash className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              style={{ textAlign: "start" }}
              placeholder="رقم التسجيل…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-9 ps-10 outline-none transition focus:border-white/30"
            />
            {number && (
              <button
                onClick={() => setNumber("")}
                aria-label="امسح"
                className="absolute end-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/*
            كشفُ القائمة — زرٌّ واحد بجانب المرشِّحات.
            محلُّه هنا لا في السطر: هذا يطبع الجدول كلَّه، وذاك يطبع
            وصلَ طالبٍ واحد.
          */}
          <button
            onClick={openSheet}
            disabled={sheeting || rows.length === 0}
            title="معاينة وطباعة كشف ملفات الطلبة"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm font-bold text-white/75 transition hover:bg-white/10 disabled:opacity-40"
          >
            {sheeting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            معاينة وطباعة
          </button>

          <BarcodeScanner<Student>
            accent={ACCENT}
            onFound={(found) => {
              /* المسحةُ تفتح ملفَّه، وتُبقي رقمَه في الحقل سنداً لما يُرى */
              setNumber(found.studentNumber);
              setOpenStudent(found);
            }}
            copy={{
              button: "مسح بطاقة الطالب",
              buttonTitle: "افتح ملفَّ طالبٍ بمسح باركود بطاقته",
              title: "مسح رقم تسجيل الطالب",
              subtitle: "البطاقة تفتح ملفَّ صاحبها — بلا بحث",
              placeholder: "امسح باركود البطاقة، أو اكتب رقم التسجيل…",
              action: "افتح الملفّ",
              notFound: "لا وجود لطالبٍ بهذا الكود بار — الرجاء التحقّق منه.",
              hint: "الرقم مكتوبٌ تحت الباركود",
              steps: [
                <>
                  وجّه القارئ إلى{" "}
                  <span className="font-bold text-white/85">باركود بطاقة الطالب</span>، أو
                  إلى الباركود المطبوع على وصل تسجيله.
                </>,
                <>القارئ يكتب الرقم في الحقل أدناه من نفسه ثمّ يُرسله — لا تضغط شيئاً.</>,
                <>تُفتح نافذةُ ملفّه: وثائقُه وحقوقُ تسجيله، وتُطبع ورقتُه من هناك.</>,
              ],
            }}
            resolve={async (text) => {
              const code = text.trim();
              const { students } = await listStudents({ search: code, limit: 20 });

              /* المطابقةُ تامّة: بحثُ الخادم الحرّ يلتقط أرقام الهواتف أيضاً */
              return students.find((row) => row.studentNumber === code) ?? null;
            }}
          />

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
            {[
              { v: "false", label: "الناقصة" },
              { v: "true", label: "المكتملة" },
              { v: "", label: "الكل" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setStatus(o.v as "" | "true" | "false")}
                className="rounded-lg px-3 py-1.5 text-xs font-bold transition"
                style={
                  status === o.v
                    ? { background: `${ACCENT}22`, color: ACCENT }
                    : { color: "rgba(255,255,255,0.5)" }
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/50">
                <th className="px-4 py-3 text-start font-bold">الطالب</th>
                {required.map((t) => (
                  <th key={t.key} className="px-3 py-3 text-center font-bold">
                    {t.label}
                  </th>
                ))}
                {/*
                  حقوق التسجيل عمودٌ كالوثائق: هي شرطُ اكتمال الملفّ مثلها،
                  ومن يفتح هذه الشاشة يسأل «ماذا ينقص هذا الطالب؟» —
                  والمالُ ينقص كما تنقص الورقة.
                */}
                <th className="px-4 py-3 text-center font-bold">حقوق التسجيل</th>
                <th className="px-4 py-3 text-center font-bold">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={required.length + 4} className="px-4 py-16 text-center text-white/40">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={required.length + 4} className="px-4 py-16 text-center">
                    <FolderCheck className="mx-auto mb-3 h-10 w-10 text-white/15" />
                    <p className="text-white/50">
                      {status === "false"
                        ? "لا ملفات ناقصة — كلها مكتملة"
                        : "لا نتائج"}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((student) => {
                  const name = `${student.firstName} ${student.lastName}`;
                  const have = new Set(student.documentTypes ?? []);
                  const done = student.completeness?.isComplete;

                  return (
                    <tr key={student.id} className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={student.avatar} name={name} gender={student.gender} size={34} />
                          <span className="font-bold">{name}</span>
                        </div>
                      </td>

                      {required.map((t) => (
                        <td key={t.key} className="px-3 py-3 text-center">
                          {have.has(t.key) ? (
                            <CheckCircle2 className="mx-auto h-4.5 w-4.5 text-emerald-300" />
                          ) : (
                            <span className="mx-auto block h-2 w-2 rounded-full bg-white/15" />
                          )}
                        </td>
                      ))}

                      <td className="px-4 py-3 text-center">
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={
                            student.registrationFeePaid
                              ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                              : { background: "rgba(252,211,77,0.14)", color: "#fcd34d" }
                          }
                        >
                          {student.registrationFeePaid ? "دُفعت" : "لم تُدفع"}
                        </span>

                        {student.registrationFeePaid &&
                          student.registrationFeeAmount !== null && (
                            <span className="mt-0.5 block text-[10px] text-white/35">
                              {formatMoney(student.registrationFeeAmount, currency)}
                            </span>
                          )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={
                            done
                              ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                              : { background: "rgba(252,211,77,0.14)", color: "#fcd34d" }
                          }
                        >
                          {done
                            ? "مكتمل"
                            : `ينقصه ${student.completeness?.missing.length ?? "؟"}`}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openReceipt(student)}
                            disabled={preparing === student.id}
                            title="معاينة وطباعة وصل الملفّ"
                            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold transition hover:bg-white/20 disabled:opacity-50"
                          >
                            {preparing === student.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Printer className="h-3.5 w-3.5" />
                            )}
                            الوصل
                          </button>

                          <button
                            onClick={() => setOpenStudent(student)}
                            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold transition hover:bg-white/20"
                          >
                            إدارة الوثائق
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-white/50">
            <span>
              {pagination.total} ملف · صفحة {pagination.page} من {pagination.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= لوحة الوثائق ================= */}
      {sheetRows && (
        <SheetPreview
          title="كشف ملفات الطلبة"
          subtitle={`${sheetRows.length} ملفاً — ${scope}`}
          onRefresh={openSheet}
          onClose={() => setSheetRows(null)}
        >
          <StudentFilesSheet rows={sheetRows} required={required} scope={scope} />
        </SheetPreview>
      )}

      {receipt && (
        <PrintPreview
          doc={{
            title: `وصل ملفّ ${receipt.student.studentNumber}`,
            render: () => (
              <RegistrationReceiptDoc
                student={receipt.student}
                catalogue={receipt.catalogue}
                currency={currency}
              />
            ),
          }}
          onClose={() => setReceipt(null)}
        />
      )}

      {openStudent && (
        <FormDialog
          icon={FolderCheck}
          title={`${openStudent.firstName} ${openStudent.lastName}`}
          subtitle="وثائق الملف — ارفع أو استبدل، والاكتمال يُحسب فور الرفع"
          tone={ACCENT}
          onClose={() => {
            setOpenStudent(null);
            /* الإغلاق يُنعش الجدول — عمودُ الاكتمال تغيّر بما رُفع هنا */
            fetchRows();
          }}
        >
          <div className="space-y-5">
            {/*
              اللوحُ نفسه المستعمَل في نافذة التسجيل — لا نسخةٌ ثانية.
              فما يُصلَح في أحدهما يُصلَح في الآخر، ولا يتخلّف عنه.
            */}
            <RegistrationFee
              student={openStudent}
              defaultAmount={defaultFee}
              currency={currency}
              onChange={(next) => {
                setOpenStudent(next);
                /* الجدولُ خلفها يتبع — الشارةُ تتبدّل بلا إعادة جلب */
                setRows((list) =>
                  list.map((row) => (row.id === next.id ? next : row)),
                );
              }}
              onFail={setError}
            />

            <DocumentsPanel studentId={openStudent.id} />
          </div>
        </FormDialog>
      )}
    </div>
  );
}
