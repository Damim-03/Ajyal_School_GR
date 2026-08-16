/**
 * هياكل تحميل (Skeletons) — تحلّ محلّ «جارٍ التحميل...» لكتل البيانات،
 * فيرى المستخدم شكل المحتوى قبل وصوله بدل شاشة فارغة.
 * الوميض عبر CSS (بلا إعادة رسم React) ويحترم تقليل الحركة تلقائياً.
 */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <span className={`skk-skeleton block rounded-md ${className}`} />;
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col gap-2 p-3" aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonBar key={c} className={`h-5 ${c === 1 ? "flex-[2]" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
