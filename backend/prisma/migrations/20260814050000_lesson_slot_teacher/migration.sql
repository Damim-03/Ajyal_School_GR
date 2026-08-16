-- ------------------------------------------------------
-- الفترة تصير مملوكةً لأستاذ
--
-- كانت حصص التوقيت جدولاً موحَّداً للمؤسسة كما في المدرسة النظامية.
-- ومركزُ الدعم غيرُ ذلك: كلُّ أستاذٍ يأتي في أوقاته، وقد يدرّس اثنان
-- في 08:00 كلٌّ في قاعته وفوجه. فالفترة الآن تخصّ أستاذاً، والفارغُ
-- منها يبقى فترةً عامّة للمؤسسة.
--
-- وأثرُه على التحقّق: منعُ التداخل الزمني كان داخل السنة، فصار داخل
-- **أوقات الأستاذ الواحد** — وإلّا لَمَنَعَ أستاذاً من التدريس في وقتٍ
-- يدرّس فيه زميلُه، وهو الغرض من التغيير أصلاً.
--
-- و `ownerKey` بصمةُ المالك: القيد على (سنة، أستاذ، ترتيب) لا يمنع
-- تكرار الترتيب بين الفترات العامّة لأنّ MySQL يعتبر كل NULL مميّزاً.
-- ------------------------------------------------------

ALTER TABLE `LessonSlot`
    ADD COLUMN `teacherId` VARCHAR(191) NULL,
    ADD COLUMN `ownerKey` VARCHAR(191) NULL;

-- الفترات القائمة عامّة — لم يكن لها مالك
UPDATE `LessonSlot`
SET `ownerKey` = CONCAT('yr:', `academicYearId`, '|tch:-')
WHERE `ownerKey` IS NULL;

ALTER TABLE `LessonSlot` MODIFY `ownerKey` VARCHAR(191) NOT NULL;

-- الجديد قبل إسقاط القديم — الدرس المستفاد من migration الفهارس السابقة
CREATE UNIQUE INDEX `LessonSlot_ownerKey_order_key` ON `LessonSlot`(`ownerKey`, `order`);

DROP INDEX `LessonSlot_academicYearId_order_key` ON `LessonSlot`;

CREATE INDEX `LessonSlot_teacherId_idx` ON `LessonSlot`(`teacherId`);

ALTER TABLE `LessonSlot` ADD CONSTRAINT `LessonSlot_teacherId_fkey`
    FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
