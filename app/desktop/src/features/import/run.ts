import type { PlannedRow } from "./plan";

/**
 * **مرحلةُ الكتابة — سطراً سطراً، بالمسار الذي يمرّ به التسجيل اليدوي.**
 *
 * كلُّ سطرٍ طلبٌ مستقلّ إلى `POST /students` أو `POST /teachers`، فيُولَّد
 * رقمُ الطالب داخل معاملةٍ ويُفحص المستوى ويُتحقَّق من كلّ حقل — كما
 * لو أنّ موظّفاً كتبه في النافذة.
 *
 * **ولا تراجعَ شاملاً**، ولا يمكن أن يكون: أربعمئة سطرٍ أربعمئةُ معاملةٍ
 * مستقلّة، ولا تُلفّ في واحدة. فالتعويضُ أن يُعرف بدقّةٍ ما كُتب وما لم
 * يُكتب، وأن تكون إعادةُ التشغيل آمنةً بفضل كشف التكرار.
 */

export interface RunProgress {
  readonly done: number;
  readonly total: number;
  readonly created: number;
  readonly failed: number;
  /** ثوانٍ متبقّية من انتظار حدّ المعدّل — صفرٌ حين لا انتظار */
  readonly waiting: number;
}

export interface RowOutcome {
  readonly rowNumber: number;
  readonly label: string;
  readonly ok: boolean;
  readonly error?: string;
}

type Creator = (payload: Record<string, unknown>) => Promise<unknown>;

interface HttpError {
  response?: {
    status?: number;
    headers?: Record<string, string>;
    data?: { message?: string };
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * ثوانٍ ينتظرها قبل إعادة المحاولة — من ترويسة الخادم لا بالتخمين.
 *
 * `express-rate-limit` يرسل `Retry-After` بالثواني. وفارغُها يعني
 * ارتداداً محافظاً بدل رقمٍ مخترَع.
 */
const retryAfter = (error: HttpError): number => {
  const header = error.response?.headers?.["retry-after"];
  const seconds = header ? Number(header) : NaN;

  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 900) : 60;
};

const messageOf = (error: unknown): string => {
  const http = error as HttpError;

  return http.response?.data?.message ?? "تعذّر الاتصال بالخادم";
};

/** محاولتان بعد الأولى — وثالثةٌ رابعةٌ لا تُصلح حدَّ معدّلٍ لم ينقضِ */
const MAX_WAITS = 2;

/**
 * ينفّذ الخطّة ويُعيد نتيجة كلّ سطر.
 *
 * والحدُّ لا يُتجنَّب بإبطاءٍ مسبق: **الخادم يُبلغ به حين يبلغه**
 * (‏429 + `Retry-After`)، فيُنتظر ويُعاد. وإبطاءُ كلّ استيرادٍ خوفاً
 * من حدٍّ لا يبلغه أكثرُ الملفّات يجعل مئةَ سطرٍ تأخذ دقيقتين بلا سبب.
 */
export const runImport = async (
  rows: readonly PlannedRow[],
  create: Creator,
  onProgress: (progress: RunProgress) => void,
  signal?: AbortSignal,
): Promise<RowOutcome[]> => {
  const outcomes: RowOutcome[] = [];

  let created = 0;
  let failed = 0;

  const report = (waiting = 0) =>
    onProgress({
      done: outcomes.length,
      total: rows.length,
      created,
      failed,
      waiting,
    });

  report();

  for (const row of rows) {
    if (signal?.aborted) break;
    if (!row.payload) continue;

    let waits = 0;

    for (;;) {
      try {
        await create(row.payload);

        created++;
        outcomes.push({ rowNumber: row.rowNumber, label: row.label, ok: true });
        break;
      } catch (error) {
        const status = (error as HttpError).response?.status;

        if (status === 429 && waits < MAX_WAITS && !signal?.aborted) {
          waits++;

          /* عدٌّ تنازليٌّ مرئيّ — الانتظارُ الصامت يُقرأ تعليقاً */
          for (let left = retryAfter(error as HttpError); left > 0; left--) {
            if (signal?.aborted) break;
            report(left);
            await sleep(1000);
          }

          report();
          continue;
        }

        failed++;
        outcomes.push({
          rowNumber: row.rowNumber,
          label: row.label,
          ok: false,
          error: messageOf(error),
        });
        break;
      }
    }

    report();
  }

  return outcomes;
};
