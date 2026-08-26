import { describe, expect, it } from "vitest";

import { refreshCookieOptions } from "./auth.cookie";

/**
 * **يُختبر لأنّ خطأه لا يظهر إلّا بعد ربع ساعة.**
 *
 * سمةٌ واحدة خاطئة في هذه الكعكة لا تُسقط شيئاً في حينه: الدخول
 * ينجح لأنّ `accessToken` يعود في جسم الاستجابة. ثمّ ينقضي، فتفشل
 * `/auth/refresh` لأنّ المتصفّح لم يرسل كعكةً لم يقبلها أصلاً،
 * فيَطرد المعترضُ المستخدمَ. لا خطأ في سجلّ، ولا رسالة على شاشة —
 * فقط خروجٌ دوريّ يُنسب إلى «الشبكة».
 *
 * وقد كان الشرطُ معلَّقاً على `NODE_ENV`، فصار على بروتوكول الطلب
 * نفسِه: متغيّرٌ يُنسى في لوحة الاستضافة، والبروتوكول لا يُنسى.
 */

describe("refreshCookieOptions", () => {
  /*
   * الإنتاج: نافذةُ Tauri على `http://tauri.localhost` والخادمُ على
   * نطاقٍ آخر — سياقٌ عابرٌ للمواقع لا تعبره إلّا `None`، و`None`
   * لا تُقبل بلا `Secure`. فالسمتان تجيئان معاً أو لا تنفع واحدةٌ.
   */
  it("عبر HTTPS: none + secure — وإلّا لم تُخزَّن الكعكة أصلاً", () => {
    const options = refreshCookieOptions({ secure: true });

    expect(options.sameSite).toBe("none");
    expect(options.secure).toBe(true);
  });

  /*
   * التطوير: الخادمُ والواجهة على localhost، سياقُ موقعٍ واحد.
   * و`Secure` هنا خطأ لا تشدّد — المتصفّح يرفض كعكةً آمنةً على HTTP.
   */
  it("عبر HTTP: strict بلا secure", () => {
    const options = refreshCookieOptions({ secure: false });

    expect(options.sameSite).toBe("strict");
    expect(options.secure).toBe(false);
  });

  it("المسار محصورٌ بمسار التجديد وحده، والكعكة محجوبةٌ عن JavaScript", () => {
    for (const secure of [true, false]) {
      const options = refreshCookieOptions({ secure });

      expect(options.path).toBe("/api/auth/refresh");
      expect(options.httpOnly).toBe(true);
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });
});
