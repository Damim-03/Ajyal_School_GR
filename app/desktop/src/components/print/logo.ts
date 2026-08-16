import { assetUrl } from "../../lib/asset-url";
import type { SchoolSettings } from "../../core/stores/school.store";

/**
 * شعار المؤسسة كما يُطبع.
 *
 * مصدر واحد لثلاث شاشات: ترويسة المطبوعة، ومعاينة الهوية، وتجربة
 * الطباعة. لو حسبت كلٌّ منها المرشّح بنفسها لاختلفت المعاينة عن
 * الورقة — وهو بالضبط ما تُفترَض المعاينة أن تمنعه.
 *
 * **العرض بالمليمتر لا بالبكسل.** البكسل وحدة شاشة: 76px تخرج نحو
 * 20mm على الورق، والرقم الذي يضبطه المستخدم لا يقول له شيئاً عن عرض
 * الشعار على ورقٍ عرضه 72mm. وبالمليمتر يصير الضبط مباشراً: 18mm من
 * 72mm أي ربع العرض.
 *
 * لماذا مرشِّحان: الطابعة الحرارية أحادية البتّ — كل نقطة سوداء أو
 * بيضاء، لا رمادَ بينهما. فشعارٌ متدرّج يُحوَّل بعتبةٍ عمياء فتضيع
 * تفاصيله أو يخرج كتلةً سوداء.
 *
 *   • **التباين** يقرّب الصورة من أبيض وأسود صافٍ فتحدّ الحوافُّ.
 *   • **الوضوح** (سطوع) يزيح العتبة التي يصير عندها الرمادي أسود:
 *     ارفعه إن خرج الشعار كتلةً سوداء، واخفضه إن خرج باهتاً.
 */

export interface LogoSpec {
  /** رابط قابل للعرض، أو undefined إن لم يُرفع شعار */
  src?: string;
  /** العرض على الورق بالمليمتر */
  widthMm: number;
  /** قيمة CSS filter جاهزة */
  filter: string;
  contrast: number;
  clarity: number;
}

const DEFAULTS = { widthMm: 18, contrast: 100, clarity: 100 };

/** بكسل الشاشة إلى مليمتر الورق — 96 نقطة في البوصة */
const PX_PER_MM = 96 / 25.4;

export const LOGO_RANGES = {
  width: [8, 40] as const,
  contrast: [50, 400] as const,
  clarity: [50, 200] as const,
};

const numeric = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || raw === undefined || raw === "") return fallback;
  return Math.min(max, Math.max(min, n));
};

type Override = Partial<Record<"path" | "width" | "contrast" | "clarity", string>>;

/** يبني المواصفة من الإعدادات، مع تجاوزات للمعاينة الحيّة قبل الحفظ */
export function logoSpec(settings: SchoolSettings, override?: Override): LogoSpec {
  const pick = (key: string, short: keyof Override) => override?.[short] ?? settings[key];

  /*
   * جسر من الإعداد القديم: نسخة سابقة حفظت الارتفاع بالبكسل في
   * `school.logo_size`. من ضبط شعاره مرّة لا يعود إلى الافتراضي لأنّ
   * الوحدة تغيّرت خلفه — يُحوَّل رقمه بدل أن يُهمَل.
   */
  const rawWidth = pick("school.logo_width_mm", "width");
  const legacyPx = settings["school.logo_size"];

  const widthMm =
    rawWidth !== undefined && rawWidth !== ""
      ? numeric(rawWidth, DEFAULTS.widthMm, ...LOGO_RANGES.width)
      : legacyPx
        ? numeric(
            String(Math.round(Number(legacyPx) / PX_PER_MM)),
            DEFAULTS.widthMm,
            ...LOGO_RANGES.width,
          )
        : DEFAULTS.widthMm;

  const contrast = numeric(
    pick("school.logo_contrast", "contrast"),
    DEFAULTS.contrast,
    ...LOGO_RANGES.contrast,
  );
  const clarity = numeric(
    pick("school.logo_clarity", "clarity"),
    DEFAULTS.clarity,
    ...LOGO_RANGES.clarity,
  );

  return {
    src: assetUrl(pick("school.logo_path", "path")),
    widthMm,
    contrast,
    clarity,
    /*
     * التدرّج الرمادي أوّلاً: الطابعة ستحوّله على أي حال، وتحويله هنا
     * يجعل المعاينة تُري ما سيخرج. ثمّ السطوع يزيح العتبة والتباين
     * يشدّ حولها.
     */
    filter: `grayscale(1) brightness(${clarity}%) contrast(${contrast}%)`,
  };
}
