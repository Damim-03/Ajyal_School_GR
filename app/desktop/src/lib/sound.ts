/**
 * الصوت — مؤثّراتٌ قصيرة وموسيقى خلفية، وهما لا يُعالَجان بأداةٍ واحدة.
 *
 * **المؤثّرُ عبر Web Audio مفكوكاً في الذاكرة.** خمسون كيلوبايت فأقلّ،
 * يُفكّ مرّةً ويُشغَّل من مخزنه بلا تأخير ولا حدٍّ لتراكبه. و`<audio>`
 * لا يصلح له: أوّلُ تشغيلٍ يتأخّر عشراتِ الأجزاء عن الضغطة، والعنصرُ
 * الواحد لا يُشغّل نفسه مرّتين متداخلتين.
 *
 * **والموسيقى عبر `<audio>` مبثوثةً.** ولا خيار: نغمتا الخلفية 24 و23
 * ميغابايت، وفكُّ مثلهما إلى PCM يبتلع مئاتِ الميغابايتات من الذاكرة
 * لأجل صوتٍ يُسمع مرّةً في الجلسة. والبثُّ يقرأ ما يحتاجه فحسب.
 *
 * **والصوتُ محبوسٌ حتى يلمس المستخدم الشاشة.** سياسةُ التشغيل التلقائي
 * تعلّق `AudioContext` وترفض `play()` قبل أوّل إيماءة، وشاشةُ الإقلاع
 * تطلب النغمة قبل أن يضغط أحدٌ شيئاً. فما يُطلب قبل الفكّ لا يضيع:
 * يُحفظ ويُطلق عند أوّل ضغطة — إن طُلب حفظُه.
 */

/*
 * الملفّات كعناوين لا كوحدات: `?url` يُبقيها ملفّاتٍ منفصلة يجلبها
 * المتصفّح عند الحاجة، ولو ضُمّت إلى الحزمة لصارت 47 ميغابايت من
 * base64 تُحمَّل كلُّها قبل أن تُرسم الشاشة الأولى.
 */
const FILES = import.meta.glob("../assets/sounds/**/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** الملفُّ باسمه لا بمساره — الأسماء فيها مسافاتٌ ونقاطٌ وأرقامُ ترتيب */
const file = (name: string): string => {
  const key = Object.keys(FILES).find((path) => path.endsWith(`/${name}`));

  if (!key) {
    console.warn("[sound] ملفٌّ مفقود:", name);
    return "";
  }

  return FILES[key]!;
};

// --------------------------------------------------
// الخريطة — اسمٌ دلاليّ لكلّ ملفّ
// --------------------------------------------------

const SFX = {
  boot: file("ps5_start.mp3"),
  firstStartup: file("001. First Time Startup.mp3"),
  focus: file("17. Focus Move Psfx Focus Move.mp3"),
  changePanel: file("06. Change Panel Psfx Change Pane.mp3"),
  enter: file("11. Enter Psfx Enter.mp3"),
  cancel: file("05. Cancel Psfx Cancel.mp3"),
  openDialog: file("26. Open Dialog Psfx Open Dialog.mp3"),
  closeDialog: file("10. Close Option Menu Psfx Close Optio.mp3"),
  openMenu: file("29. Open Option Menu Psfx Open Option.mp3"),
  openDrawer: file("25. Open Control Center Psfx Open Contro.mp3"),
  closeDrawer: file("09. Close Control Center Psfx Close Contr.mp3"),
  openHome: file("28. Open Home Psfx Open Home.mp3"),
  error: file("14. Error Toasts Something Is Broken Psfx Error Toast.mp3"),
  success: file("45. Yes in Dialog Psfx Yes in Dial.mp3"),
  logout: file("22. Log Out Psfx Log Out.mp3"),
  passcode: file("31. Pass Code Psfx Pass Code.mp3"),
  /* إشعارٌ يُقرأ — الخبرُ العاديّ */
  notify: file("18. Informative Toasts Something to Read Psfx Informative.mp3"),
  /* إشعارٌ يُفعَل — فيه زرٌّ ينتظر */
  notifyAction: file("19. Interactive Toasts Something to Do Psfx Interactive.mp3"),
  /* نغمةُ إشعار PS5 — للترحيب عند الدخول */
  notification: file("Voicy_Notification Of Playstation 5.mp3"),
  /* إنجازٌ يستحقّ الوقوف عنده — نادرٌ عمداً */
  trophy: file("39. Trophy Toast Psfx Trophy Toas.mp3"),
  homeLoad: file("Voicy_Home Menu Load Of  Playstation 5.mp3"),
} as const;

export type SfxName = keyof typeof SFX;

/**
 * مدد المؤثّرات — **الجزءُ المسموع وحده**، يقرؤها المنسّق ليزامن الحركة
 * مع الصوت.
 *
 * تُملأ من الملفّ نفسه لحظة فكّه، فلا رقمَ مكتوباً بخطّ اليد يتخلّف عن
 * ملفٍّ استُبدل. وقبل الفكّ تبقى فارغةً — ولذلك يقرؤها المستدعي بقيمةٍ
 * احتياطية (`SFX_DURATION_MS.homeLoad ?? 2360`).
 *
 * وكانت المدّةَ الخام؛ فصارت مدّةَ ما يُسمع بعد أن صار الصمتُ الأوّل
 * يُتخطّى (انظر `SFX_ONSET_S`). وهو ما كان مستهلكوها يفترضونه أصلاً.
 */
export const SFX_DURATION_MS: Partial<Record<SfxName, number>> = {};

const AMBIENT = {
  select: file("002. Select User.mp3"),
  home: file("003. Home Menu.mp3"),
} as const;

export type AmbientTrack = keyof typeof AMBIENT;

// --------------------------------------------------
// شدّةُ الصوت — تفضيلٌ يبقى بين الجلسات
// --------------------------------------------------

const VOLUME_KEY = "sound.volume";

/** نصفُ المدى افتراضاً: المؤثّرات تُسمع ولا تُزعج في قاعةٍ فيها ناس */
const readVolume = (): number => {
  try {
    const saved = localStorage.getItem(VOLUME_KEY);
    const value = saved === null ? NaN : Number(saved);

    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  } catch {
    return 1;
  }
};

let masterVolume = readVolume();

export const getSoundVolume = () => masterVolume;

export const setSoundVolume = (value: number) => {
  masterVolume = Math.min(1, Math.max(0, value));

  try {
    localStorage.setItem(VOLUME_KEY, String(masterVolume));
  } catch {
    /* الحفظ رفاهية — لا يُعطّل الصوت */
  }

  /* الموسيقى الجارية تتبع التفضيل فوراً، ولا تنتظر أغنيةً تالية */
  for (const track of tracks.values()) {
    track.el.volume = track.target * masterVolume;
  }
};

// --------------------------------------------------
// طبقةُ المؤثّرات — Web Audio
// --------------------------------------------------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const context = (): AudioContext | null => {
  if (ctx) return ctx;

  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctor) return null;

  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  return ctx;
};

const buffers = new Map<SfxName, AudioBuffer>();
const decoding = new Map<SfxName, Promise<AudioBuffer | null>>();

// --------------------------------------------------
// بدايةُ ما يُسمع — تخطّي الصمت الأوّل
// --------------------------------------------------

/**
 * **الصمتُ الذي في أوّل الملفّ ليس صمتاً في التجربة — إنّه تأخير.**
 *
 * قِستُ ملفّات الإشعارات فوجدتُ نغمةَ الترحيب تبدأ بعد **1300ms** من
 * صمتٍ رقميّ، ونغمةَ تحميل الرئيسية بعد **655ms**. و`source.start()`
 * بلا إزاحةٍ يُشغّل الصمتَ كما يُشغّل الصوت: فالبطاقةُ تظهر وتستقرّ
 * وتكاد تنطوي، ثمّ تُسمع نغمتُها. ولا رابطَ حينئذٍ بين ما رأى المستخدم
 * وما سمع — وهو أسوأ من ألّا يكون هناك صوت.
 *
 * ولا يُعالَج بمهلةٍ مكتوبة في طبقة الإشعارات: الرقمُ يخصّ الملفّ لا
 * المكوّن، وأيُّ ملفٍّ يُستبدل يُبطلها بصمت. فيُقاس من الملفّ نفسِه
 * لحظةَ فكّه.
 *
 * والقياسُ بمغلّف الطاقة (RMS) في نوافذَ من 5ms، والعتبةُ **نسبةٌ من
 * ذروة الملفّ** لا رقمٌ مطلق: ذروُ هذه العيّنات تتفاوت سبعةَ أضعاف
 * (0.04 إلى 0.34)، فعتبةٌ مطلقة كانت ستقصّ أوّلَ الهادئ وتترك صمتَ
 * الصاخب.
 */
const ONSET_WINDOW_S = 0.005;
/** أوّلُ نافذةٍ تبلغ 2% من الذروة — حيث يبدأ ما تلتقطه الأذن. */
const ONSET_RATIO = 0.02;
/**
 * تمهيدٌ يُترك قبلها.
 *
 * القصُّ عند العتبة تماماً يبتر نأمةَ الهجوم فتُسمع النغمةُ مقطوعةَ
 * المبتدأ — والأذنُ تلتقط ذلك ولو لم تسمّه. وخمسةَ عشرَ مللي ثانية
 * تكفي لبقاء الهجوم طبيعياً ولا تُعيد تأخيراً يُحسّ.
 */
const ONSET_PREROLL_S = 0.015;

/** إزاحةُ التشغيل لكلّ نغمة (بالثواني) — تُحسب مرّةً عند الفكّ. */
export const SFX_ONSET_S: Partial<Record<SfxName, number>> = {};

const findOnset = (buffer: AudioBuffer): number => {
  const data = buffer.getChannelData(0);
  const window = Math.max(1, Math.round(buffer.sampleRate * ONSET_WINDOW_S));

  /* تمريرةٌ واحدة: المغلّف وذروتُه معاً. الملفّات ثوانٍ معدودة فالكلفة لا شيء. */
  const envelope: number[] = [];
  let peak = 0;

  for (let i = 0; i + window <= data.length; i += window) {
    let sum = 0;
    for (let j = i; j < i + window; j++) sum += data[j] * data[j];

    const rms = Math.sqrt(sum / window);
    envelope.push(rms);
    if (rms > peak) peak = rms;
  }

  if (peak === 0) return 0;

  const gate = peak * ONSET_RATIO;
  const first = envelope.findIndex((v) => v >= gate);

  if (first <= 0) return 0;

  return Math.max(0, first * ONSET_WINDOW_S - ONSET_PREROLL_S);
};

const decode = (name: SfxName): Promise<AudioBuffer | null> => {
  const cached = buffers.get(name);
  if (cached) return Promise.resolve(cached);

  const inFlight = decoding.get(name);
  if (inFlight) return inFlight;

  const url = SFX[name];
  const audio = context();

  if (!url || !audio) return Promise.resolve(null);

  const job = fetch(url)
    .then((response) => response.arrayBuffer())
    .then((bytes) => audio.decodeAudioData(bytes))
    .then((buffer) => {
      buffers.set(name, buffer);

      const onset = findOnset(buffer);
      SFX_ONSET_S[name] = onset;
      /* المدّةُ ما يبقى بعد الصمت — وهي التي تُبنى عليها المزامنة. */
      SFX_DURATION_MS[name] = Math.round((buffer.duration - onset) * 1000);

      return buffer;
    })
    .catch(() => null)
    .finally(() => decoding.delete(name));

  decoding.set(name, job);

  return job;
};

// --------------------------------------------------
// الفكّ — أوّل إيماءةٍ من المستخدم
// --------------------------------------------------

let unlocked = false;

/** ما طُلب قبل الفكّ وأصرّ صاحبُه على سماعه (`queueIfBlocked`) */
const queued: { name: SfxName; volume: number }[] = [];
let queuedAmbient: { track: AmbientTrack; fadeMs: number } | null = null;

const unlock = () => {
  if (unlocked) return;
  unlocked = true;

  void context()?.resume();

  for (const item of queued.splice(0)) play(item.name, item.volume);

  if (queuedAmbient) {
    const { track, fadeMs } = queuedAmbient;
    queuedAmbient = null;
    playAmbient(track, fadeMs);
  }
};

for (const event of ["pointerdown", "keydown", "touchstart"] as const) {
  window.addEventListener(event, unlock, { once: false, passive: true });
}

// --------------------------------------------------
// التشغيل
// --------------------------------------------------

/**
 * كبحُ التتابع السريع.
 *
 * من يمسك السهم في الشاشة الرئيسية يُطلق «تنقّل» كلَّ بضعةِ أجزاء من
 * الثانية، فتتراكب النغمةُ على نفسها وتصير طنيناً. فلا تُعاد النغمةُ
 * الواحدة قبل انقضاء هذه المهلة — والمهلةُ لكلّ اسمٍ على حدة، فصوتُ
 * الخطأ لا يكبحه صوتُ تنقّلٍ سبقه.
 */
const MIN_GAP_MS = 45;
const lastPlayed = new Map<SfxName, number>();

const play = (name: SfxName, volume: number) => {
  const audio = context();
  if (!audio) return;

  const buffer = buffers.get(name);

  /* لم يُفكّ بعد — يُفكّ ثمّ يُشغَّل، فأوّلُ ضغطةٍ تُسمع ولو متأخّرةً قليلاً */
  if (!buffer) {
    void decode(name).then((ready) => {
      if (ready) play(name, volume);
    });
    return;
  }

  const source = audio.createBufferSource();
  const gain = audio.createGain();

  source.buffer = buffer;
  gain.gain.value = Math.min(1, Math.max(0, volume)) * masterVolume;

  source.connect(gain);
  gain.connect(master!);
  /*
   * يبدأ من حيث يبدأ الصوتُ لا من حيث يبدأ الملفّ.
   * بلا هذه الإزاحة كانت نغمةُ الترحيب تُسمع بعد بطاقتها بـ1.3 ثانية.
   */
  source.start(0, SFX_ONSET_S[name] ?? 0);

  /* العقدةُ تُفصل عند الانتهاء — وإلّا تراكمت عقدُ كلّ ضغطةٍ في الرسم البياني */
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
};

/**
 * مؤثّرٌ واحد.
 *
 * `queueIfBlocked` لمن لا يُغني عنه فوتُه — نغمةُ دخول الشاشة الرئيسية
 * تُطلب مع أوّل تصيير، وقد يكون الصوتُ ما يزال محبوساً. وما عداها
 * يُهمَل بلا ضجيج: صوتُ تنقّلٍ فات لا يُشغَّل بعد ثانيتين في غير موضعه.
 */
export function sfx(name: SfxName, volume = 0.5, queueIfBlocked = false) {
  if (masterVolume === 0) return;

  const now = performance.now();
  const last = lastPlayed.get(name) ?? 0;

  if (now - last < MIN_GAP_MS) return;
  lastPlayed.set(name, now);

  if (!unlocked) {
    if (queueIfBlocked) queued.push({ name, volume });
    return;
  }

  play(name, volume);
}

/** فكُّ ما سيُطلب قريباً — كي لا يتأخّر أوّلُ تشغيلٍ عن ضغطته */
export function warmupSfx(...names: SfxName[]) {
  for (const name of names) void decode(name);
}

// --------------------------------------------------
// طبقةُ الموسيقى — <audio> مبثوث
// --------------------------------------------------

/**
 * الموسيقى خلفيةٌ لا موضوع: سقفُها دون المؤثّرات كي لا تطغى عليها.
 *
 * ورُفِع مع رفعها (0.32 ← 0.46) حفاظاً على النسبة: المؤثّرات
 * ارتفعت نحوَ الثمانين بالمئة، ولو بقيت النغمةُ مكانَها لصارت
 * همساً تحتها. والنسبةُ بينهما هي ما يجعل الواجهة تُسمع
 * دون أن تُصمّ.
 */
const AMBIENT_LEVEL = 0.46;
/**
 * خطوةُ التدرّج — عشرون جزءاً من الألف، أي خمسون تحديثاً في الثانية.
 *
 * كانت خمسين فصار التلاشي عشرين درجةً في الثانية، وذلك يُسمع تدرّجاً
 * مسنَّناً في نغمةٍ ممتدّة (ما يُعرف بـzipper noise). والخمسون تحديثاً
 * تحت عتبة ما تلتقطه الأذن، وكلفتُها لا شيء: عمليةُ ضربٍ واحدة على
 * عنصرٍ واحد.
 */
const FADE_STEP_MS = 20;

interface Track {
  el: HTMLAudioElement;
  /** المستوى المقصود قبل ضربه في شدّة النظام */
  target: number;
  fade: number | null;
  duck: number | null;
}

const tracks = new Map<AmbientTrack, Track>();
let current: AmbientTrack | null = null;

const element = (name: AmbientTrack): Track | null => {
  const existing = tracks.get(name);
  if (existing) return existing;

  const url = AMBIENT[name];
  if (!url) return null;

  const el = new Audio(url);
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;

  const track: Track = { el, target: 0, fade: null, duck: null };
  tracks.set(name, track);

  return track;
};

/**
 * تدرُّجٌ خطّيّ على `volume`.
 *
 * ولا `GainNode`: وصلُ العنصر بـ Web Audio يستلزم
 * `createMediaElementSource`، وهو يحوّل مسار الصوت كلَّه إلى الرسم
 * البياني — فيفقد البثُّ بساطتَه ويصير كلُّ تعثّرٍ في الشبكة صمتاً في
 * السماعة. والخطوةُ خمسون جزءاً من الألف: أنعمُ ممّا تلتقطه الأذن في
 * تلاشٍ يمتدّ قرابةَ الثانية.
 */
const fadeTo = (track: Track, to: number, ms: number, done?: () => void) => {
  if (track.fade !== null) window.clearInterval(track.fade);

  const from = track.target;
  const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
  let step = 0;

  track.fade = window.setInterval(() => {
    step += 1;

    const ratio = Math.min(1, step / steps);

    /**
     * منحنى جيبيّ لا خطّ مستقيم.
     *
     * التدرّجُ الخطّي على `volume` يُسمع قطعاً في طرفيه: يبدأ الخفوتُ
     * فجأةً من السرعة القصوى، وينتهي فجأةً عند الصفر — والأذنُ تلتقط
     * الانكسارَ في الطرفين لأنّ مشتقّة الخطّ تقفز عندهما. ولذلك كان
     * التلاشي يُسمع «قطعاً» ولو امتدّ ثانية.
     *
     * و`½ − cos(πr)/2` مشتقّتُها صفرٌ عند البداية والنهاية: يبدأ
     * الخفوتُ من السكون ويصل إلى السكون، فلا حافّةَ في أيّ طرف.
     *
     * وهذا هو المنحنى نفسُه الذي تُبنى عليه حركةُ الواجهة (`easeInOut`)
     * — فالصوتُ يتلاشى بالمنطق الذي تتلاشى به الصورة، ولذلك يبدوان
     * حركةً واحدة لا حركتين متقاربتين.
     */
    const eased = 0.5 - Math.cos(ratio * Math.PI) / 2;

    track.target = from + (to - from) * eased;
    track.el.volume = Math.min(1, Math.max(0, track.target * masterVolume));

    if (ratio >= 1) {
      window.clearInterval(track.fade!);
      track.fade = null;
      done?.();
    }
  }, FADE_STEP_MS);
};

/** تجهيزُ النغمة قبل الحاجة — البثُّ يبدأ فلا تتأخّر عن لحظتها */
export function preloadAmbient(track: AmbientTrack) {
  element(track)?.el.load();
}

/**
 * تشغيلُ نغمة خلفية.
 *
 * **والطلبُ المكرَّر يُهمَل** — تعتمد عليه شاشةُ الإقلاع: النغمةُ نفسُها
 * تمتدّ عبر انتظار Enter ثمّ اختيار المستخدم، ولو استُؤنفت عند كلّ
 * تركيبٍ لانقطعت وعادت إلى أوّلها في كلّ مرّة.
 */
export function playAmbient(track: AmbientTrack, fadeMs = 900) {
  if (masterVolume === 0) return;

  const next = element(track);
  if (!next) return;

  if (current === track && !next.el.paused) return;

  /* ما كان يعمل يتلاشى ولا يُقطع — والقطعُ يُسمع نشازاً */
  if (current && current !== track) {
    const previous = tracks.get(current);
    if (previous) fadeTo(previous, 0, Math.min(fadeMs, 600), () => previous.el.pause());
  }

  current = track;

  const started = next.el.play();

  if (started) {
    started.catch(() => {
      /*
       * رفضتها سياسةُ التشغيل التلقائي — تُحفظ لأوّل إيماءة. والموسيقى
       * تُحفظ دائماً بخلاف المؤثّرات: هي حالةُ الشاشة لا حدثٌ عابر،
       * فبقاءُ الشاشة صامتةً إلى أن يُغادرها المستخدم خطأٌ ظاهر.
       */
      if (!unlocked) queuedAmbient = { track, fadeMs };
    });
  }

  fadeTo(next, AMBIENT_LEVEL, fadeMs);
}

/**
 * خفضُ الموسيقى مؤقّتاً — ليُسمع ما فوقها.
 *
 * ولا تُوقَف: القطعُ ثمّ العودةُ أوضحُ للأذن من الكلام الذي أُريد
 * إسماعُه، والخفضُ يمرّ دون أن يُنتبه له.
 */
export function duckAmbient(holdMs = 1400, depth = 0.4) {
  if (!current) return;

  const track = tracks.get(current);
  if (!track) return;

  if (track.duck !== null) window.clearTimeout(track.duck);

  fadeTo(track, AMBIENT_LEVEL * depth, 200);

  track.duck = window.setTimeout(() => {
    track.duck = null;
    fadeTo(track, AMBIENT_LEVEL, 400);
  }, holdMs + 200);
}

/**
 * إيقافُ الموسيقى — بتلاشٍ، وعند موضعها.
 *
 * `pause` لا `currentTime = 0`: من غادر الرئيسية إلى وحدةٍ ثمّ عاد
 * يجد النغمةَ حيث تركها، لا مقطعاً يُعاد من أوّله في كلّ عودة.
 */
export function stopAmbient(fadeMs = 500) {
  if (!current) return;

  const track = tracks.get(current);
  current = null;

  if (!track) return;

  if (track.duck !== null) {
    window.clearTimeout(track.duck);
    track.duck = null;
  }

  fadeTo(track, 0, fadeMs, () => track.el.pause());
}
