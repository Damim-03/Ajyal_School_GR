import { useState } from "react";
import { BadgeDollarSign, CircleCheckBig, CircleDashed, Loader2 } from "lucide-react";

import { formatMoney, parseMoney } from "../../core/utils/money";
import { updateStudent, type Student, type StudentInput } from "./student.api";

// --------------------------------------------------
// حقوق التسجيل
// --------------------------------------------------

/**
 * زرُّ حالةٍ ومبلغ — لا نموذجٌ يُحفظ بزرٍّ ثالث.
 *
 * الحالة تُقلَب بنقرةٍ واحدة وتُحفظ لحظتَها، لأنّها الفعلُ المتكرّر:
 * الموظّف يقبض المال ويعلّمها. والمبلغُ يُكتب مرّةً ويُحفظ عند الخروج
 * من الحقل — ومبدئيُّه من إعدادات المؤسسة، فلا يُكتب في كلّ تسجيل.
 */
export function RegistrationFee({
  student,
  defaultAmount,
  currency,
  onChange,
  onFail,
}: {
  student: Student;
  defaultAmount: string;
  currency: string;
  onChange: (student: Student) => void;
  onFail: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(() =>
    student.registrationFeeAmount !== null
      ? String(student.registrationFeeAmount)
      : (defaultAmount ?? ""),
  );

  const paid = student.registrationFeePaid;

  const save = async (body: Partial<StudentInput>) => {
    setBusy(true);
    onFail(null);

    try {
      onChange(await updateStudent(student.id, body));
    } catch {
      onFail("تعذّر حفظ حالة حقوق التسجيل");
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    const next = !paid;
    const value = parseMoney(amount);

    save({
      registrationFeePaid: next,
      /* القبضُ يُثبّت المبلغ والتاريخ، والتراجعُ يمحوهما */
      registrationFeeAmount: next ? value : null,
      registrationFeePaidAt: next ? new Date().toISOString() : null,
    });
  };

  return (
    <div
      className="rounded-2xl border p-4 transition"
      style={
        paid
          ? { borderColor: "rgba(134,239,172,0.3)", background: "rgba(134,239,172,0.06)" }
          : { borderColor: "rgba(252,211,77,0.3)", background: "rgba(252,211,77,0.05)" }
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-black">
          <BadgeDollarSign
            className="h-4 w-4"
            style={{ color: paid ? "#86efac" : "#fcd34d" }}
          />
          حقوق التسجيل
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={
              paid
                ? { background: "rgba(134,239,172,0.16)", color: "#86efac" }
                : { background: "rgba(252,211,77,0.16)", color: "#fcd34d" }
            }
          >
            {paid ? "دُفعت" : "لم تُدفع"}
          </span>
        </span>

        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition hover:brightness-110 disabled:opacity-50"
          style={
            paid
              ? { background: "rgba(255,255,255,0.1)", color: "#fff" }
              : { background: "#86efac", color: "#04121c" }
          }
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : paid ? (
            <CircleDashed className="h-4 w-4" />
          ) : (
            <CircleCheckBig className="h-4 w-4" />
          )}
          {paid ? "تراجَع — لم تُدفع" : "أثبِت الدفع"}
        </button>
      </div>

      <label className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-bold text-white/50">المبلغ</span>

        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const value = parseMoney(amount);

            if (value === null || !paid) return;
            if (value === student.registrationFeeAmount) return;

            save({ registrationFeeAmount: value });
          }}
          placeholder="0.00"
          className="w-36 rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-sm font-bold outline-none focus:border-white/30"
        />

        <span className="text-[11px] text-white/35">
          {paid && student.registrationFeeAmount !== null
            ? `محفوظ: ${formatMoney(student.registrationFeeAmount, currency)}`
            : "يُحفظ عند إثبات الدفع"}
        </span>
      </label>
    </div>
  );
}
