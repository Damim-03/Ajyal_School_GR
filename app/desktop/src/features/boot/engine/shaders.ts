/**
 * **مُظلِّلاتُ محرّك الإقلاع — GLSL ES 3.00، وكلُّ الحركة فيها.**
 *
 * القرارُ الذي يقوم عليه هذا الملفّ كلُّه:
 *
 *   **الجسيمُ عديمُ الحالة.** موضعُه دالّةٌ في (بذرته، الزمن) تُحسب في
 *   مُظلِّل الرؤوس، ولا يُخزَّن في أيّ مكان.
 *
 * وثمنُ البديل يوضّح لماذا. لو كان الموضعُ محفوظاً لوجب أحدُ اثنين:
 * تحديثُه على المعالج المركزيّ ورفعُه إلى الذاكرة الرسومية في كلّ إطار
 * (وهو ما تمنعه §26)، أو «transform feedback» بمخزنين يتبادلان — وذلك
 * يضاعف الذاكرة، ويُدخل حالةً لا يمكن القفزُ فيها، ويكسر الحتميّة التي
 * تطلبها §35.
 *
 * وبانعدام الحالة تُشترى أربعةُ أشياء مجّاناً:
 *
 *   • **صفرُ عملٍ على المعالج المركزيّ** في كلّ إطار — لا حلقةَ على
 *     ثلاثة آلاف جسيم، ولا رفعَ مخزن. تُرفع المخازنُ مرّةً عند الإنشاء.
 *   • **حتميّةٌ تامّة**: اللحظةُ نفسُها تُخرج الصورةَ نفسَها دائماً.
 *   • **القفزُ في الزمن** — تقليلُ الحركة والتخطّي يضربان «uTime» ولا
 *     يحتاجان إعادةَ محاكاة.
 *   • **إطارٌ مفقودٌ لا يُراكم خطأً** — لا تكامُلَ يتخلّف.
 *
 * والحركةُ نفسُها **إزاحةٌ بدوّامة الضجيج** (curl noise displacement):
 * الموضعُ الأساس ينجرف انجرافاً بطيئاً، ويُزاح عنه بمتّجهِ دوّامةِ حقلٍ
 * كامنٍ ثلاثيّ. وذلك يُنتج الالتفافَ والانحناءَ والتمدّدَ والالتقاءَ
 * التي تطلبها §10، وهو **مجّانيٌّ في اشتقاقه** — بخلاف تكامُل مسارٍ
 * حقيقيّ الذي يلزمه حفظُ الموضع.
 */

/* ============================================================
 * دوالُّ مشتركة — الضجيج ودوّامتُه
 * ============================================================ */

/**
 * ضجيجُ قيمةٍ ثلاثيّ باستيفاءٍ خُماسيّ.
 *
 * ولمَ لا simplex: هذا أقصرُ بكثير، ومشتقّتُه الثانية متّصلة (بفضل
 * المنحنى الخُماسيّ) — وهو ما تحتاجه الدوّامةُ كي لا تُظهر حوافَّ
 * الشبكة. والفرقُ البصريّ بينهما لا يُرى في حقلٍ من نقاطٍ مضيئة.
 */
const NOISE = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  /* منحنى كوين الخُماسيّ: 6t⁵−15t⁴+10t³ — مشتقّتاه صفرٌ عند الطرفين. */
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  return mix(
    mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}

/*
 * الحقلُ الكامن — ثلاثُ عيّناتٍ متباعدة.
 *
 * والإزاحاتُ الثلاث كبيرةٌ وغيرُ منتظمة عمداً: لو تقاربت لارتبطت مركّباتُ
 * الحقل، فتصير الدوّامةُ مستويّةً تقريباً ويفقد المشهد بُعدَه الثالث.
 */
vec3 potential(vec3 p) {
  return vec3(
    vnoise(p),
    vnoise(p + vec3(31.416, 17.13, 47.29)),
    vnoise(p + vec3(-19.77, 63.21, -11.05))
  );
}

/*
 * دوّامةُ الحقل الكامن — ∇×ψ.
 *
 * وخاصّيتُها التي تجعلها الأصلحَ هنا: تباعُدُها صفرٌ رياضياً. أي أنّ
 * الحقلَ **لا مصادرَ فيه ولا مصارف** — فلا تتكوّم الجسيماتُ في نقطةٍ
 * ولا تُفرَّغ منطقةٌ فتُثقب الصورة. وهذا بالضبط ما يفصل حركةً «سائلة»
 * عن حركةٍ عشوائية.
 *
 * والاشتقاقُ بفروقٍ مركزية: ستُّ عيّناتٍ للحقل الكامن، أي 18 نداءَ
 * ضجيج. على الوحدة الرسومية هذا لا شيء، وعلى المعالج المركزيّ كان
 * سيكون كارثة — ومن هنا وجب أن يقع هنا.
 */
vec3 curl(vec3 p) {
  const float e = 0.14;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);

  vec3 px0 = potential(p - dx), px1 = potential(p + dx);
  vec3 py0 = potential(p - dy), py1 = potential(p + dy);
  vec3 pz0 = potential(p - dz), pz1 = potential(p + dz);

  return vec3(
    (py1.z - py0.z) - (pz1.y - pz0.y),
    (pz1.x - pz0.x) - (px1.z - px0.z),
    (px1.y - px0.y) - (py1.x - py0.x)
  ) / (2.0 * e);
}
`;

/* ============================================================
 * الجسيمات
 * ============================================================ */

export const PARTICLE_VERT = /* glsl */ `#version 300 es
precision highp float;

/* موضعُ البذرة داخل مكعّبٍ [-1..1] — ثابتٌ مدى الحياة. */
in vec3 aSeed;
/* size · brightness · softness · goldBias */
in vec4 aTrait;
/* layerFlow · birthOrder[0..1] · hueJitter · phase */
in vec4 aMeta;

uniform float uTime;
uniform vec2  uRes;
uniform float uDpr;

uniform float uEmerge;
uniform float uSpread;
uniform float uGold;
uniform float uBloom;
uniform float uDisperse;
uniform float uIntensity;
uniform float uStill;

uniform vec3 uBlue;
uniform vec3 uGoldC;
uniform vec3 uGoldWhite;

uniform float uFlowScale;
uniform float uFlowEvolve;
uniform float uFlowStrength;
uniform float uFlowDrift;

out vec4  vColor;
out float vSoft;

${NOISE}

void main() {
  float birth = aMeta.y;

  /*
   * الولادةُ بالترتيب — وهي ما يصنع «البذرة» ثمّ «النشأة» (§8/§9).
   *
   * كلُّ جسيمٍ يحمل رتبتَه [0..1]، ولا يُولد حتى تبلغها «uEmerge».
   * فالجسيمُ صاحبُ الرتبة صفر — وهو المزروعُ في المركز — يظهر وحده
   * أوّلاً، ثمّ يتبعه الحقل. ولا شرطَ حادّ: 0.06 من التدرّج تجعل كلّ
   * جسيمٍ **يشتعل** ولا يومض.
   */
  float alive = smoothstep(birth, birth + 0.06, uEmerge);

  /* ميّتٌ بعدُ ⇒ يُنبذ خارج الشاشة بلا حسابٍ ولا رسم. */
  if (alive <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    vSoft = 0.0;
    return;
  }

  float flowMul = aMeta.x;

  /*
   * الموضعُ الأساس ينجرف أفقياً: الحقلُ **يسيل** ولا يدور في مكانه.
   * ويُلفّ في المدى [-1..1] فلا ينفد عن الشاشة.
   */
  vec3 base = aSeed;
  base.x += uTime * uFlowDrift * flowMul;
  base.x = fract((base.x + 1.0) * 0.5) * 2.0 - 1.0;

  /* الإزاحة بالدوّامة — وهنا تُولد الحركةُ العضوية كلُّها. */
  vec3 q = base * uFlowScale + vec3(0.0, 0.0, uTime * uFlowEvolve);
  vec3 flow = curl(q) * uFlowStrength * flowMul * uStill;

  vec3 p = base + flow;

  /*
   * الامتدادُ الأفقي (§11): تمدّدٌ في س وانكماشٌ خفيفٌ في ص.
   *
   * والتمدّدُ **أقوى كلّما بعُد الجسيمُ عن المركز** («p.x * p.x»)، فيبقى
   * القلبُ كثيفاً وتنسابُ الأطرافُ خارجةً — وهو الفرقُ بين مادّةٍ تسيل
   * وانفجارٍ متساوي التوسّع.
   */
  p.x *= 1.0 + uSpread * (0.55 + 0.85 * p.x * p.x);
  p.y *= 1.0 - uSpread * 0.16;

  /* التبدّد (§22): دفعٌ إلى الخارج من المركز، لا تلاشٍ في المكان. */
  float r = max(length(p.xy), 0.001);
  p.xy += (p.xy / r) * uDisperse * (0.5 + 0.9 * aMeta.z);

  /*
   * الإسقاط — نسبةُ الشاشة تُصحَّح بالبعد الأصغر فلا يتشوّه الحقل
   * عند تغيّر النسبة (§28). والمشهدُ أعرضُ من مربّع، فيُضرب س في 1.5.
   */
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 ndc = vec2(p.x * 1.5 / max(aspect, 0.0001), p.y);

  /* عمقٌ خفيفٌ يقرّب القريبَ ويُبعد البعيد — بارالاكسٌ بلا حركة كاميرا. */
  float depth = 1.0 + p.z * 0.22;
  ndc *= depth;

  gl_Position = vec4(ndc, 0.0, 1.0);

  /* ---------- الحجم ---------- */
  float size = aTrait.x * uDpr * depth;
  /* الوهجُ يُنفخ القريبَ أكثر — الضوءُ يفيض عن مصدره. */
  size *= 1.0 + uBloom * 0.35 * aTrait.z;
  gl_PointSize = max(size, 1.0);

  /* ---------- اللون ---------- */
  /*
   * الذهبُ يُنتقى بالميل لا بالنسبة (§15).
   *
   * لكلّ جسيمٍ «goldBias» ثابت، و«uGold» عتبةٌ ترتفع. فيتذهّب الحقلُ
   * جسيماً بعد جسيمٍ بترتيبٍ **ثابتٍ** لا عشوائيّ في كلّ تشغيل —
   * والانتقالُ لكلٍّ منها ناعم (0.28) فلا يقفز لونُه.
   *
   * وكلاهما يسبح في حقل التدفّق نفسِه (§16): لا فرقَ في الحركة، الفرقُ
   * في اللون والسطوع وحدهما.
   */
  float warm = smoothstep(aTrait.w, aTrait.w + 0.28, uGold);

  vec3 col = mix(uBlue, uGoldC, warm);
  /* وعند الذروة يبيضّ أشدُّ الذهب دفئاً — لا الحقلُ كلُّه (§21). */
  col = mix(col, uGoldWhite, warm * uBloom * 0.65);

  float bright = aTrait.y * uIntensity;
  bright *= 1.0 - 0.72 * uDisperse;
  bright *= 1.0 + uBloom * warm * 0.9;

  /* وميضٌ خفيفٌ غيرُ متزامن — الحقلُ حيٌّ ولا ينبض ككتلة (§13). */
  bright *= 0.86 + 0.14 * sin(uTime * (0.7 + aMeta.z) + aMeta.w * 6.2831) * uStill;

  vColor = vec4(col * bright, alive);
  vSoft = aTrait.z;
}
`;

export const PARTICLE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec4  vColor;
in float vSoft;

uniform float uCore;
uniform float uHalo;
uniform float uHaloMix;

out vec4 fragColor;

void main() {
  /*
   * **الجسيمُ حجميٌّ لا قرص** (§8).
   *
   * نواةٌ ضيّقةٌ شديدة، وهالةٌ واسعةٌ خافتة، كلتاهما أُسّيّةٌ (غاوسية).
   * والقرصُ المصمت — أو حافّةٌ بـ«smoothstep» — يُقرأ شكلاً مرسوماً؛
   * أمّا مجموعُ غاوسيّتين مختلفتي الاتّساع فيُقرأ **ضوءاً له مركزٌ
   * ينتشر**، وهو ما تفعله العدسةُ بمصدرٍ نقطيّ.
   *
   * ولا نسيجَ يُحمَّل: الشكلُ محسوبٌ لكلّ بكسل. وذلك أرخصُ من قراءة
   * نسيجٍ في هذا الحجم، ويحرّرنا من تخصيص ذاكرةٍ رسوميةٍ لصورة (§26).
   */
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;

  /* الطبقةُ القريبة أنعمُ حافّةً — عمقٌ ميدانيّ بلا تمويهٍ حقيقيّ (§12). */
  float core = exp(-r2 * uCore * (1.0 - vSoft * 0.72));
  float halo = exp(-r2 * uHalo);

  float a = core + halo * uHaloMix;
  if (a < 0.0035) discard;

  /* جمعٌ ضوئيّ: اللونُ مضروبٌ في الشدّة، والقناةُ ألفا للتراكب. */
  fragColor = vec4(vColor.rgb * a, a * vColor.a);
}
`;

/* ============================================================
 * تمريراتُ ما بعد المعالجة
 * ============================================================ */

/** مثلّثٌ واحدٌ يغطّي الشاشة — أرخصُ من مربّعين وبلا خيطٍ في القُطر. */
export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** مرشِّحُ الإشراق — ما فوق العتبة وحده يدخل الوهج (§20). */
export const BRIGHT_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform float uThreshold;
out vec4 fragColor;

void main() {
  vec3 c = texture(uScene, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  /*
   * قصٌّ ناعمٌ لا حادّ: العتبةُ الحادّة تُظهر حافّةً تزحف على الصورة
   * حين يتغيّر السطوع تدريجياً — وهي أظهرُ ما يفضح وهجاً رخيصاً.
   */
  float k = smoothstep(uThreshold, uThreshold + 0.35, l);
  fragColor = vec4(c * k, 1.0);
}
`;

/**
 * تمويهٌ غاوسيٌّ منفصل — تمريرتان لا واحدة.
 *
 * التمويهُ ثنائيُّ البعد بنواة 9×9 يكلّف 81 قراءةً لكلّ بكسل؛ وفصلُه
 * إلى أفقيٍّ ثمّ رأسيّ يكلّف 18. والنتيجةُ متطابقةٌ رياضياً لأنّ
 * الغاوسيّة قابلةٌ للفصل.
 *
 * وأوزانُ الأخذ المزدوج (linear sampling) تختصرها أكثر: خمسُ قراءاتٍ
 * تعطي أثرَ تسع.
 */
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 fragColor;

void main() {
  vec3 sum = texture(uTex, vUv).rgb * 0.227027;

  vec2 o1 = uDir * 1.3846153846;
  vec2 o2 = uDir * 3.2307692308;

  sum += texture(uTex, vUv + o1).rgb * 0.3162162162;
  sum += texture(uTex, vUv - o1).rgb * 0.3162162162;
  sum += texture(uTex, vUv + o2).rgb * 0.0702702703;
  sum += texture(uTex, vUv - o2).rgb * 0.0702702703;

  fragColor = vec4(sum, 1.0);
}
`;

/**
 * التركيبُ الأخير — المشهدُ والوهجُ والجوُّ ثمّ تصحيحُ الجاما.
 *
 * وكلُّ ما بعد المعالجة يقع هنا لا في طبقاتٍ متراكبة من CSS: طبقةُ
 * «backdrop-filter» واحدةٌ ملءَ الشاشة تكلّف أكثرَ من هذه التمريرة
 * كلِّها، وهي لا تعرف شيئاً عن عمق المشهد.
 */
export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec3  uGround;
uniform vec3  uBlue;
uniform vec3  uGoldWhite;
uniform float uBloomStrength;
uniform float uVignette;
uniform float uHaze;
uniform float uIntensity;
uniform float uWarm;
uniform float uTime;
uniform float uEmerge;

out vec4 fragColor;

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;

  vec3 c = scene + bloom * uBloomStrength;

  /*
   * الضبابُ الجوّي (§19) — تدرّجان لا دخان.
   *
   * واحدٌ يتمركز حول القلب فيسند العمق، وآخرُ يميل إلى أسفل الإطار
   * فيمنع أن تُقرأ الصورةُ مسطّحة. وكلاهما شديدُ الخفوت: إن لوحظ
   * كضبابٍ فهو قويٌّ زيادة.
   */
  vec2 p = vUv - 0.5;
  float d = length(p * vec2(1.0, 1.35));

  /*
   * **الضبابُ مقرونٌ بالحقل — لا يسبقه.**
   *
   * كان ثابتاً، فقِستُ الصورةَ عند 0.5s فوجدت مركزَها [49,67,105]: هالةٌ
   * زرقاءُ واضحة **قبل أن يُولد جسيمٌ واحد**. وذلك يُفسد أهمَّ لحظةٍ في
   * المشهد — البذرةُ الأولى (§8) يجب أن تُرى في عتمة، لا أن تُضاف إلى
   * ضوءٍ قائم.
   *
   * والاقترانُ أصدقُ فيزيائياً أيضاً: الضبابُ ضوءٌ **تبعثره** الجسيمات،
   * فلا مصدرَ له قبلها.
   */
  float core = exp(-d * d * 5.5);
  vec3 hazeCol = mix(uBlue, uGoldWhite, uWarm);
  c += hazeCol * core * uHaze * uIntensity * (0.06 + 0.94 * uEmerge);

  /* تنفّسٌ بطيءٌ جدّاً — الجوُّ حيٌّ ولا يتكرّر ظاهراً (§28 في المرجع). */
  float breathe = 0.94 + 0.06 * sin(uTime * 0.21);
  c += uGround * 3.0 * exp(-abs(p.y + 0.34) * 4.0) * uHaze * breathe * (0.2 + 0.8 * uEmerge);

  /* القاعُ فحميٌّ لا أسودُ خالص — يمنع الحوافَّ الميّتة. */
  c += uGround;

  /* ظلمةُ الأطراف: المركزُ يشرق والحوافُّ تبقى داكنة (§21). */
  float vig = 1.0 - uVignette * smoothstep(0.28, 0.92, d);
  c *= vig;

  /*
   * ترسيمُ النطاق (tone mapping) قبل الجاما.
   *
   * «c/(1+c)» يمنع القصَّ عند الأبيض: بلا ذلك تتحوّل ذروةُ الوهج إلى
   * رقعةٍ بيضاءَ مسطّحة يضيع فيها تدرّجُ الذهب — وهو ما تنهى عنه §21
   * صراحةً («لا تجعل الشاشة كلَّها بيضاء»).
   */
  c = c / (1.0 + c);

  /* من الفضاء الخطّيّ إلى فضاء العرض. */
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));

  fragColor = vec4(c, 1.0);
}
`;
