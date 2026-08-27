import { describe, expect, it, vi } from "vitest";

import { runImport } from "./run";
import type { PlannedRow } from "./plan";

/**
 * **يُختبر لأنّ حدَّ المعدّل لا يظهر إلّا في ملفٍّ كبير.**
 *
 * الخادم يسمح بألف طلبٍ في ربع ساعة. فملفٌّ من مئتَي سطرٍ يمرّ في
 * كلّ تجربةٍ يدوية، وملفُّ المؤسسة الحقيقيّ يبلغ الحدَّ في منتصفه —
 * وسلوكُ البرنامج عندها هو ما يُقاس هنا لا ما يُفترض.
 */

const row = (rowNumber: number): PlannedRow => ({
  rowNumber,
  label: `طالب ${rowNumber}`,
  status: "ready",
  payload: { firstName: "علي", lastName: "بن عمر" },
  problems: [],
  warnings: [],
});

const rateLimited = (retryAfter: string) => ({
  response: { status: 429, headers: { "retry-after": retryAfter }, data: {} },
});

describe("runImport", () => {
  it("تكتب كلَّ سطرٍ وتُبلّغ بالتقدّم", async () => {
    const create = vi.fn().mockResolvedValue({});
    const seen: number[] = [];

    const out = await runImport([row(2), row(3)], create, (p) => seen.push(p.done));

    expect(create).toHaveBeenCalledTimes(2);
    expect(out.every((o) => o.ok)).toBe(true);
    expect(seen[seen.length - 1]).toBe(2);
  });

  /* سطرٌ يسقط لا يوقف ما بعده — وإلّا صار خطأٌ واحد يمنع الملفّ */
  it("تتجاوز الساقط وتُكمل", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ response: { status: 422, data: { message: "الاسم مطلوب" } } })
      .mockResolvedValueOnce({});

    const out = await runImport([row(2), row(3), row(4)], create, () => {});

    expect(out.map((o) => o.ok)).toEqual([true, false, true]);
    expect(out[1].error).toBe("الاسم مطلوب");
    expect(out[1].rowNumber).toBe(3);
  });

  it("تنتظر عند حدّ المعدّل ثمّ تُعيد المحاولة", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(rateLimited("1"))
      .mockResolvedValueOnce({});

    const waits: number[] = [];

    const out = await runImport([row(2)], create, (p) => {
      if (p.waiting > 0) waits.push(p.waiting);
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(out[0].ok).toBe(true);
    /* العدُّ التنازليّ يُبلَّغ به — الانتظارُ الصامت يُقرأ تعليقاً */
    expect(waits.length).toBeGreaterThan(0);
  });

  it("تستسلم بعد محاولتَي انتظار ولا تدور أبداً", async () => {
    const create = vi.fn().mockRejectedValue(rateLimited("1"));

    const out = await runImport([row(2)], create, () => {});

    expect(create).toHaveBeenCalledTimes(3); // الأولى + انتظاران
    expect(out[0].ok).toBe(false);
  });

  it("تتوقّف عند الإلغاء ولا تكتب ما بعده", async () => {
    const controller = new AbortController();
    const create = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.resolve({});
    });

    const out = await runImport(
      [row(2), row(3), row(4)],
      create,
      () => {},
      controller.signal,
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(out).toHaveLength(1);
  });

  it("تتخطّى سطراً بلا حمولة", async () => {
    const create = vi.fn().mockResolvedValue({});
    const blocked: PlannedRow = {
      rowNumber: 9,
      label: "x",
      status: "blocked",
      problems: ["خطأ"],
      warnings: [],
    };

    await runImport([blocked], create, () => {});

    expect(create).not.toHaveBeenCalled();
  });
});
