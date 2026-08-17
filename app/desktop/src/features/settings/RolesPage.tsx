import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Check,
  Loader2,
  Lock,
  Plus,
  Save,
  Shield,
  ShieldPlus,
  Trash2,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { FormDialog, FormGrid, FormRow } from "../../components/shared/FormDialog";
import { apiClient } from "../../core/api/client";
import { useAuthStore } from "../../core/stores/auth.store";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";

const ACCENT = "#fda4af";

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions?: { permission: Permission }[];
  _count?: { users: number; permissions: number };
}

interface Permission {
  id: string;
  name: string;
  module: string;
  description: string | null;
}

/** «student.create» → الفعل وحده */
const actionOf = (name: string) => name.split(".")[1] ?? name;

const MODULE_LABEL: Record<string, string> = {
  STUDENT: "الطلبة",
  TEACHER: "الأساتذة",
  TEACHING_ASSIGNMENT: "إسناد الأساتذة",
  ENROLLMENT: "إسناد الطلبة",
  SUBJECT: "المواد",
  STUDY_GROUP: "الأفواج",
  LEVEL: "المستويات",
  EDUCATION_STAGE: "الأطوار",
  ACADEMIC_YEAR: "السنوات الدراسية",
  SCHEDULE: "الجداول",
  SESSION: "الحصص",
  ATTENDANCE: "الحضور",
  INVOICE: "الفواتير",
  PAYMENT: "المدفوعات",
  RECEIPT: "الإيصالات",
  REPORT: "التقارير",
  USER: "المستخدمون",
  ROLE: "الأدوار",
  SETTINGS: "الإعدادات",
  CLASSROOM: "القاعات",
  LESSON_SLOT: "حصص التوقيت",
  TUITION_FEE: "حقوق الاشتراك",
  SETTLEMENT_POLICY: "سياسات التخليص",
  SETTLEMENT: "تخليص الأساتذة",
};

const ACTION_LABEL: Record<string, string> = {
  view: "عرض",
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  cancel: "إلغاء",
  confirm: "تأكيد",
  print: "طباعة",
  reprint: "إعادة طباعة",
  export: "تصدير",
};

/**
 * الأدوار والصلاحيات.
 *
 * الصلاحية لا تُمنح لشخص بل لدور، والشخص يرث دورَه. فتغييرُ ما يستطيعه
 * المحاسبون جميعاً تعديلٌ واحد هنا، لا مرورٌ على كل حساب.
 *
 * والمصفوفة مجمَّعة بالموديول لا قائمةً مسطّحة من واحدٍ وتسعين اسماً:
 * من يبحث عن «هل يستطيع الأمين إلغاء فاتورة؟» يقرأ سطر الفواتير، ولا
 * يمسح قائمةً أبجدية.
 *
 * ودور النظام (`isSystem`) لا يُحذف — ADMIN بلا صلاحيات يقفل النظام
 * على الجميع بلا طريق عودة.
 */
export default function RolesPage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [granted, setGranted] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiClient.get("/roles", { params: { limit: 100 } }),
        apiClient.get("/permissions", { params: { limit: 500 } }),
      ]);

      const rows = rolesRes.data.data as Role[];
      setRoles(rows);
      setPermissions(permsRes.data.data as Permission[]);

      setSelectedId((current) =>
        current && rows.some((r) => r.id === current)
          ? current
          : (rows[0]?.id ?? ""),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب الأدوار");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  /* صلاحيات الدور تُقرأ من تفصيله — القائمة لا تحملها */
  useEffect(() => {
    if (!selectedId) {
      setGranted(new Set());
      return;
    }

    let alive = true;

    apiClient
      .get(`/roles/${selectedId}`)
      .then((res) => {
        if (!alive) return;
        const role = res.data.data.role as Role;
        setGranted(
          new Set((role.permissions ?? []).map((p) => p.permission.id)),
        );
      })
      .catch(
        (err) =>
          alive &&
          setError(err?.response?.data?.message ?? "تعذّر جلب صلاحيات الدور"),
      );

    return () => {
      alive = false;
    };
  }, [selectedId]);

  /** مجمَّعة بالموديول، ومرتَّبة بترتيب الأفعال المعتاد */
  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();

    for (const p of permissions) {
      map.set(p.module, [...(map.get(p.module) ?? []), p]);
    }

    const order = ["view", "create", "update", "delete", "cancel", "confirm"];

    return [...map.entries()]
      .map(([module, rows]) => ({
        module,
        label: MODULE_LABEL[module] ?? module,
        rows: [...rows].sort(
          (a, b) =>
            order.indexOf(actionOf(a.name)) - order.indexOf(actionOf(b.name)),
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "ar"));
  }, [permissions]);

  const toggle = (id: string) =>
    setGranted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleModule = (rows: Permission[]) =>
    setGranted((prev) => {
      const next = new Set(prev);
      const allOn = rows.every((r) => next.has(r.id));
      for (const r of rows) allOn ? next.delete(r.id) : next.add(r.id);
      return next;
    });

  const save = async () => {
    if (!selected) return;

    setSaving(true);
    setError(null);

    try {
      await apiClient.put(`/roles/${selected.id}/permissions`, {
        permissionIds: [...granted],
      });

      await load();
      flash(`حُفظت صلاحيات ${selected.name}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: Role) => {
    try {
      await apiClient.delete(`/roles/${role.id}`);
      await load();
      flash("حُذف الدور");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الحذف");
    }
  };

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 2600);
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الأدوار والصلاحيات" subtitle="ما يستطيعه كل دور">
        <button
          onClick={() => exitTo(PATHS.settings)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1500px] p-6">
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="whitespace-pre-line">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid place-items-center py-32">
            <Loader2 className="h-7 w-7 animate-spin text-white/30" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
            {/* ====== الأدوار ====== */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-white/10 p-3">
                <span className="text-xs font-bold text-white/50">
                  {roles.length} دور
                </span>
                {can("role.create") && (
                  <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black text-[#2b0410] transition hover:brightness-110"
                    style={{ background: ACCENT }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    دور
                  </button>
                )}
              </div>

              {roles.map((role) => {
                const active = role.id === selectedId;

                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedId(role.id)}
                    className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-start transition last:border-0"
                    style={active ? { background: `${ACCENT}1f` } : undefined}
                  >
                    <Shield
                      className="h-4 w-4 shrink-0"
                      style={{ color: active ? ACCENT : "rgba(255,255,255,0.3)" }}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        {role.name}
                        {role.isSystem && (
                          <Lock className="h-3 w-3 text-white/30" />
                        )}
                      </span>
                      <span className="block text-[11px] text-white/35">
                        {role._count?.users ?? 0} مستخدم ·{" "}
                        {role._count?.permissions ?? 0} صلاحية
                      </span>
                    </span>

                    {can("role.delete") && !role.isSystem && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(role);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && remove(role)}
                        className="rounded-lg p-1.5 text-rose-300/60 transition hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ====== المصفوفة ====== */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
              {!selected ? (
                <div className="grid place-items-center px-6 py-24 text-center">
                  <Shield className="mb-3 h-11 w-11 text-white/15" />
                  <p className="text-white/60">اختر دوراً</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="flex items-center gap-2 text-lg font-black">
                        {selected.name}
                        {selected.isSystem && (
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/50">
                            دور نظام
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-white/40">
                        {granted.size} صلاحية مفعّلة من {permissions.length}
                      </p>
                    </div>

                    {can("role.update") && (
                      <button
                        onClick={save}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#2b0410] transition hover:brightness-110 disabled:opacity-40"
                        style={{ background: ACCENT }}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        احفظ الصلاحيات
                      </button>
                    )}
                  </div>

                  <div className="max-h-[64vh] overflow-y-auto p-4">
                    <div className="grid gap-2.5">
                      {grouped.map(({ module, label, rows }) => {
                        const on = rows.filter((r) => granted.has(r.id)).length;
                        const all = on === rows.length;

                        return (
                          <div
                            key={module}
                            className="rounded-xl border border-white/10 bg-black/20 p-3"
                          >
                            <div className="mb-2.5 flex items-center gap-3">
                              <button
                                onClick={() => toggleModule(rows)}
                                className="flex items-center gap-2 text-sm font-black transition hover:opacity-80"
                              >
                                <span
                                  className="grid h-4 w-4 place-items-center rounded border transition"
                                  style={
                                    all
                                      ? { background: ACCENT, borderColor: ACCENT }
                                      : on > 0
                                        ? { background: `${ACCENT}55`, borderColor: ACCENT }
                                        : { borderColor: "rgba(255,255,255,0.25)" }
                                  }
                                >
                                  {all && (
                                    <Check className="h-3 w-3 text-[#2b0410]" />
                                  )}
                                </span>
                                {label}
                              </button>

                              <span className="text-[11px] text-white/30">
                                {on}/{rows.length}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {rows.map((p) => {
                                const active = granted.has(p.id);
                                const action = actionOf(p.name);

                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => toggle(p.id)}
                                    title={p.name}
                                    className="rounded-lg px-2.5 py-1 text-[11px] font-bold transition"
                                    style={
                                      active
                                        ? { background: `${ACCENT}26`, color: ACCENT }
                                        : {
                                            background: "rgba(255,255,255,0.04)",
                                            color: "rgba(255,255,255,0.4)",
                                          }
                                    }
                                  >
                                    {ACTION_LABEL[action] ?? action}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {creating && (
        <NewRoleDialog
          onClose={() => setCreating(false)}
          onDone={async (name) => {
            setCreating(false);
            await load();
            flash(`أُنشئ الدور ${name}`);
          }}
        />
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-rose-400/30 bg-rose-500/15 px-5 py-2.5 text-sm font-bold text-rose-100 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

function NewRoleDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      await apiClient.post("/roles", {
        name: name.trim(),
        description: description.trim() || null,
      });

      onDone(name.trim());
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الإنشاء");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      icon={ShieldPlus}
      title="دور جديد"
      subtitle="يُنشأ بلا صلاحيات — تُمنح من المصفوفة بعد الإنشاء."
      tone={ACCENT}
      width="md"
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitDisabled={name.trim().length < 2}
      submitLabel="أنشئ"
      submitIcon={<Check className="h-4.5 w-4.5" />}
      error={error}
    >
      <FormGrid>
        <FormRow>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">الاسم</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: ACCOUNTANT"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            />
          </label>
        </FormRow>

        <FormRow>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">الوصف</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
            />
          </label>
        </FormRow>
      </FormGrid>
    </FormDialog>
  );
}
