-- ------------------------------------------------------
-- رقم المحاولة — لأن الإلغاء كان طريقاً مسدوداً
--
-- كان القيد الفريد (إسناد + كشف) يسمح بتخليصٍ واحد مهما كانت حاله.
-- فالتخليص الملغى يبقى شاغلاً موضعه، ولا يُقبل بديلٌ عنه أبداً —
-- بينما رسالةُ الخطأ نفسها تنصح بـ«ألغِ واحسب بديلاً». نصيحةٌ
-- لا يمكن اتّباعها.
--
-- بإضافة revision يبقى الملغى كما هو ويأخذ البديل رقماً تالياً،
-- فيُحفظ التاريخ ويُتاح التصحيح معاً.
--
-- وشرطُ «واحدٌ غير ملغى في كل وقت» يبقى في service layer: MySQL
-- لا يعرف الفهارس الجزئية، فلا يُعبَّر عنه بقيد.
-- ------------------------------------------------------

ALTER TABLE `Settlement` ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 1;

-- الترتيب هنا ليس تفضيلاً: الفهرس القديم هو السند الوحيد للمفتاح
-- الأجنبي على teachingAssignmentId، وMySQL يرفض إسقاطه ما لم يبقَ
-- فهرسٌ آخر يبدأ بذلك العمود. فيُنشأ البديل أولاً ثم يُسقط القديم.
CREATE UNIQUE INDEX `Settlement_teachingAssignmentId_attendanceSheetId_revision_key`
    ON `Settlement`(`teachingAssignmentId`, `attendanceSheetId`, `revision`);

DROP INDEX `Settlement_teachingAssignmentId_attendanceSheetId_key` ON `Settlement`;
