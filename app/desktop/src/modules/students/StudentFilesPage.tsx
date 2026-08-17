import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderCheck,
  Loader2,
  Search,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { FormDialog } from "../../components/shared/FormDialog";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { DocumentsPanel } from "./DocumentsPanel";
import {
  getDocumentTypes,
  listStudents,
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
  const [status, setStatus] = useState<"" | "true" | "false">("false");
  const [page, setPage] = useState(1);

  const [openStudent, setOpenStudent] = useState<Student | null>(null);

  useEffect(() => {
    getDocumentTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, status]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debounced && { search: debounced }),
      ...(status && { documentsComplete: status === "true" }),
    }),
    [page, debounced, status],
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

  const required = types.filter((t) => t.required);

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
          <div className="relative min-w-70 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن طالب…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-4 ps-10 outline-none transition focus:border-white/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

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
                <th className="px-4 py-3 text-center font-bold">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={required.length + 3} className="px-4 py-16 text-center text-white/40">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={required.length + 3} className="px-4 py-16 text-center">
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
                        <button
                          onClick={() => setOpenStudent(student)}
                          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold transition hover:bg-white/20"
                        >
                          إدارة الوثائق
                        </button>
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
          <DocumentsPanel studentId={openStudent.id} />
        </FormDialog>
      )}
    </div>
  );
}
