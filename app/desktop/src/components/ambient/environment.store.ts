import { create } from "zustand";

/**
 * حالة الإضاءة البيئية (§6).
 *
 * الفكرة: البيئة نفسها تستجيب لأحداث النظام بدل أن تُلصَق التغذية الراجعة
 * على العنصر الذي أطلقها. النجاح ليس وميضاً أخضر فوق زرّ، بل نبضة ضوء باردة
 * خفيفة تمرّ على المشهد كلّه ثم تخبو. والخطأ ليس اهتزازاً، بل دفء طفيف في
 * الجوّ. وفتح نافذة يُعتم المحيط قليلاً لأن الانتباه انتقل إلى طبقة أعلى.
 *
 * هذا يُبقي التغذية الراجعة مقروءة دون أن تكسر التسلسل الحركي: لا وميض،
 * ولا لون صارخ، ولا حركة تسرق الانتباه من المهمّة.
 */

export type LightPulse = "success" | "error" | null;

interface EnvironmentState {
  /** نبضة عابرة تُصفّر نفسها. */
  pulse: LightPulse;
  /** عدد الطبقات المفتوحة فوق المحتوى (نوافذ متداخلة). */
  overlays: number;
  firePulse: (kind: Exclude<LightPulse, null>) => void;
  pushOverlay: () => void;
  popOverlay: () => void;
}

/** مدّة النبضة — ضمن نطاق «مُرضٍ لكن مقيَّد» (§6). */
export const PULSE_MS = { success: 900, error: 700 } as const;

export const useEnvironment = create<EnvironmentState>()((set) => ({
  pulse: null,
  overlays: 0,
  firePulse: (kind) => {
    set({ pulse: kind });
    window.setTimeout(() => set((s) => (s.pulse === kind ? { pulse: null } : s)), PULSE_MS[kind]);
  },
  // عدّاد لا منطقي بولياني: النوافذ المتداخلة يجب ألّا يُعيد إغلاقُ الأعلى
  // منها إضاءةَ المشهد بينما ما زالت واحدة مفتوحة تحتها.
  pushOverlay: () => set((s) => ({ overlays: s.overlays + 1 })),
  popOverlay: () => set((s) => ({ overlays: Math.max(0, s.overlays - 1) })),
}));

/** استدعاء من أي مكان — بما فيه شيفرة غير React. */
export const firePulse = (kind: Exclude<LightPulse, null>) =>
  useEnvironment.getState().firePulse(kind);
