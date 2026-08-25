"use strict";
// ======================================================
// طبقةُ التقارير — المرحلة الأولى
//
// أربعةُ ملفّاتٍ لا يعتمد أيٌّ منها على Prisma Client في وقت
// التشغيل ولا يفتح اتصالاً بقاعدة البيانات:
//
//   money.ts       حسابٌ مالي بـDecimal، وقسمةٌ آمنة  — §59
//   active.ts      شرائحُ `where` لاستثناء الملغى      — §52
//   metrics.ts     تعريفُ كلّ مؤشّرٍ مرّةً واحدة        — §65 §66
//   period.ts      الفترات وحقولُ الأعمال              — §58 §34
//   definitions.ts كتالوجٌ يُقرأ في الواجهة            — §66 §70
//
// وكونُها نقيّةً ليس ترفاً معمارياً: هو ما يجعل §74 قابلاً للاختبار
// اليوم، على قاعدةٍ فارغة، وعلى استضافةٍ حصّتُها من الاتصالات
// محدودة. الاستعلاماتُ تُبنى فوق هذه الطبقة في المرحلة الثانية.
// ======================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./money"), exports);
__exportStar(require("./active"), exports);
__exportStar(require("./metrics"), exports);
__exportStar(require("./period"), exports);
__exportStar(require("./definitions"), exports);
//# sourceMappingURL=index.js.map