/**
 * التحكّمُ بالنافذة — ويعمل في المتصفّح كما يعمل في Tauri.
 *
 * صارت النافذة بلا زخارف (`decorations: false`) لأجل الإيهام بواجهة
 * جهاز، **وذلك يزيل زرَّ الإغلاق**. فوجب أن تُقدّم الواجهةُ بديلاً —
 * وإلّا بقي المستخدم بلا مخرجٍ إلّا Alt+F4، وهو ليس مخرجاً يُعلَّم
 * عليه أحد.
 *
 * والاستيرادُ ديناميٌّ وموصولٌ بفحصٍ زمنَ التشغيل: الواجهةُ تُطوَّر في
 * المتصفّح على 5173 حيث لا وجودَ لـ Tauri، واستيرادٌ ساكن كان يُسقط
 * الوحدةَ كلَّها هناك. فما لا يوجد يُتجاهَل بصمت.
 */

const inTauri = () =>
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);

/** إغلاقُ التطبيق — لا شيء في المتصفّح */
export const closeApp = async () => {
  if (!inTauri()) return;

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch {
    /* الصلاحيةُ ناقصة أو النافذة ذهبت — لا شيء يُفعل ولا شيء يُكسر */
  }
};

/**
 * تبديلُ ملء الشاشة — به يُخفى شريطُ ويندوز عند العرض.
 *
 * وله طريقان لا طريق: نافذةُ Tauri حيث يوجد، وواجهةُ المتصفّح القياسية
 * حيث لا يوجد. وكان يعود صامتاً خارج Tauri — وهو مقبولٌ ما دام لا يُنادى
 * إلّا من اختصارِ F11 في شاشة الدخول، فأمّا وقد صار زرّاً في الشريط
 * العلوي فلا: زرٌّ يُضغط ولا يقع شيء عطلٌ في عين مستخدمه، ولا فرقَ عنده
 * بين «الميزة غائبة» و«الزرّ مكسور».
 */
export const toggleFullscreen = async () => {
  if (inTauri()) {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();

      await win.setFullscreen(!(await win.isFullscreen()));
      return;
    } catch {
      /* الصلاحيةُ ناقصة — يُجرَّب طريقُ المتصفّح أدناه */
    }
  }

  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    /* رفضَها المتصفّح (تحتاج إيماءةً مباشرة) — لا شيء يُكسر */
  }
};

export const isDesktopShell = inTauri;
