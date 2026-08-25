import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { downloadExport, fetchExportCenter } from "./reports.api";
import { reportKeys } from "./hooks/use-report";

// ======================================================
// مركزُ التصدير — §63
//
// القائمةُ تُجلب من الخادم **مصفّاةً بالصلاحيات** لا تُبنى محلّياً:
// شاشةٌ تعرض «سجلّ التدقيق» لمن لا يراه تكشف وجودَه وتدعوه إلى
// محاولةٍ تُرفض. والتصفيةُ في الخادم (§67) والشاشةُ تعرض ما وصلها.
// ======================================================

export const ExportsPage = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: reportKeys.exports,
    queryFn: fetchExportCenter,
    staleTime: 5 * 60_000,
  });

  const run = async (report: string, format: "csv" | "xlsx") => {
    setBusy(`${report}:${format}`);
    setFailed(null);

    try {
      const { blob, filename } = await downloadExport(report, format);

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = filename;
      anchor.click();

      URL.revokeObjectURL(url);
    } catch {
      setFailed(report);
    } finally {
      setBusy(null);
    }
  };

  const groups = data
    ? [...new Set(data.reports.map((report) => report.groupTitle))]
    : [];

  return (
    <div className="min-h-full bg-[#05070d] text-white">
      <header className="border-b border-white/10 bg-white/[0.03] px-6 pb-4 pt-4">
        <nav className="mb-1 text-[11px] text-white/35">
          التقارير <span className="mx-1">/</span>
          <span className="text-white/60">مركز التصدير</span>
        </nav>
        <h1 className="text-lg font-semibold text-white">مركز التصدير</h1>
        <p className="mt-0.5 text-xs text-white/50">
          تصدير أيّ تقرير بصيغة Excel أو CSV. الملفّ يحترم الفلاتر
          المضبوطة في شاشة التقرير نفسه.
        </p>
      </header>

      <main className="space-y-6 p-6">
        {/*
          §42 يطلب PDF والطباعة أيضاً، وهما من التطبيق لا من الخادم.
          والسببُ يُذكر صراحةً بدل أن يبحث المستخدمُ عن زرٍّ ليس
          موجوداً ويظنّه عطباً.
        */}
        {data?.note && (
          <aside className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <Printer className="mt-0.5 size-4 shrink-0 text-white/35" aria-hidden />
            <div>
              <p className="text-xs font-medium text-white/75">
                PDF والطباعة
              </p>
              <p className="mt-0.5 text-xs text-white/50">{data.note}</p>
              <p className="mt-1 text-xs text-white/50">
                افتح التقرير واضغط «طباعة» — ومن حوار الطباعة يمكن
                الحفظ بصيغة PDF.
              </p>
            </div>
          </aside>
        )}

        {failed && (
          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            تعذّر التصدير. قد تنقصك صلاحية التصدير لهذا التقرير.
          </p>
        )}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-lg bg-white/[0.03]"
              />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/50">
            تعذّر تحميل قائمة التقارير.
          </p>
        )}

        {groups.map((groupTitle) => (
          <section key={groupTitle}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/35">
              {groupTitle}
            </h2>

            <ul className="space-y-2">
              {data?.reports
                .filter((report) => report.groupTitle === groupTitle)
                .map((report) => (
                  <li
                    key={report.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-sm font-medium text-white hover:underline"
                        onClick={() =>
                          navigate(
                            report.key === "overview"
                              ? "/reports"
                              : `/reports/${report.key}`,
                          )
                        }
                      >
                        {report.title}
                      </button>
                      <p className="mt-0.5 text-xs text-white/50">
                        {report.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs text-white/60 hover:bg-white/[0.06] disabled:opacity-50"
                        onClick={() => void run(report.key, "xlsx")}
                        disabled={busy !== null}
                      >
                        <FileSpreadsheet className="size-3.5" aria-hidden />
                        {busy === `${report.key}:xlsx` ? "…" : "Excel"}
                      </button>

                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs text-white/60 hover:bg-white/[0.06] disabled:opacity-50"
                        onClick={() => void run(report.key, "csv")}
                        disabled={busy !== null}
                      >
                        <Download className="size-3.5" aria-hidden />
                        {busy === `${report.key}:csv` ? "…" : "CSV"}
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
};
