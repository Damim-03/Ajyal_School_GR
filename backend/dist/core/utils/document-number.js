"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniqueDocumentNumber = exports.randomDocumentNumber = void 0;
const node_crypto_1 = require("node:crypto");
/**
 * رقم المستند — ثلاث عشرة خانة عشوائية.
 *
 * كان الترقيم متسلسلاً بسابقة: `PAY-2026-08-0001`. وهو صالحٌ للقراءة
 * لكنّه لا يُمسح: الباركود أسفل الإيصال يشفّر الرقم ليُسترجع المستند
 * بمسحةٍ بدل نقله باليد، والرقم المتسلسل يفشي أيضاً حجم الحركة — من
 * قرأ `0037` عرف أنّ المؤسسة قبضت سبعاً وثلاثين دفعة هذا الشهر.
 *
 * فصار ثلاثَ عشرة خانةً عشوائية: طولٌ يكفي لباركود EAN‑13 كما يكفي
 * لـCode128، ومجالٌ من تسعة آلاف مليار احتمال يجعل التصادم نادراً —
 * ومع ندرته يُفحص قبل الحفظ ويحرسه قيد `@@unique` في القاعدة.
 *
 * والعشوائية من `node:crypto` لا من `Math.random`: الأخيرة متوقَّعةٌ
 * من مخرجاتها، ورقمُ إيصالٍ يمكن تخمينه يفتح باب تزوير إيصالٍ لم
 * يُصدر.
 */
const DIGITS = 13;
/** «4820193857016» — الخانة الأولى ليست صفراً فيبقى الطول ثلاث عشرة */
const randomDocumentNumber = () => {
    let value = String((0, node_crypto_1.randomInt)(1, 10));
    for (let i = 1; i < DIGITS; i++)
        value += String((0, node_crypto_1.randomInt)(0, 10));
    return value;
};
exports.randomDocumentNumber = randomDocumentNumber;
/**
 * رقمٌ لم يُستعمل — أو `null` إن تعذّر بعد محاولات.
 *
 * الفحص بدالّة يمرّرها المستدعي لأنّ الجدول يختلف (دفعة أو إيصال)
 * ولأنّ الفحص يجب أن يقع **داخل** المعاملة نفسها التي ستحفظ الصف.
 *
 * والمحاولات ثمانٍ لا لأنّ التصادم متوقَّع، بل لأنّ الحلقة اللانهائية
 * عند خللٍ في القاعدة أسوأ من خطأٍ صريح.
 */
const uniqueDocumentNumber = async (taken, attempts = 8) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const candidate = (0, exports.randomDocumentNumber)();
        if (!(await taken(candidate)))
            return candidate;
    }
    return null;
};
exports.uniqueDocumentNumber = uniqueDocumentNumber;
//# sourceMappingURL=document-number.js.map