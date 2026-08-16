-- ------------------------------------------------------
-- نطاق التسعير: الفوج لم يعد الطريق الوحيد إلى السعر
--
-- كان الصفّ يسعّر (مادة + فوج) لا غير، فتسعيرُ مادةٍ لطورٍ كامل
-- يعني صفّاً لكل فوجٍ فيه، وتغييرُ السعر يعني تعديلها جميعاً.
--
-- صار النطاق أربعةَ حقول اختيارية، والفارغُ منها «أيّاً كان». وعند
-- تعدّد المطابقات يفوز أخصُّها بأوزان ثنائية: فوج 8 · مستوى 4 ·
-- طور 2 · نوعية 1. الثنائيةُ مقصودة — مجموع كل تركيبة فريد، فلا
-- تعادلَ يحتاج قاعدةَ كسر. الترجيح في resolveTuitionFee.
--
-- و`scopeKey` ضرورةٌ لا زينة: MySQL يعتبر كل NULL مميّزاً عن غيره،
-- فقيدٌ فريد على الأعمدة الاختيارية نفسها لا يمنع صفَّين متطابقَي
-- النطاق. البصمةُ النصّية تجعل القيد ممكناً.
--
-- الترحيل غير مدمِّر: كل صفّ قائم له studyGroupId، فتُبنى بصمتُه
-- منه ويبقى سلوكه حرفياً كما كان.
-- ------------------------------------------------------

-- المفتاح الأجنبي يُسقط قبل تليين العمود ثم يُعاد. الإسقاطُ بلا
-- إعادة هو ما أفسد migration سابقة، فالإعادة هنا في نفس الملف.
ALTER TABLE `TuitionFee` DROP FOREIGN KEY `TuitionFee_studyGroupId_fkey`;

DROP INDEX `TuitionFee_subjectId_studyGroupId_effectiveFrom_key` ON `TuitionFee`;

ALTER TABLE `TuitionFee`
    MODIFY `studyGroupId` VARCHAR(191) NULL,
    ADD COLUMN `levelId` VARCHAR(191) NULL,
    ADD COLUMN `educationStageId` VARCHAR(191) NULL,
    ADD COLUMN `groupType` ENUM('NORMAL', 'ELITE', 'INTENSIVE', 'EVENING') NULL,
    ADD COLUMN `scopeKey` VARCHAR(255) NULL;

-- بصمة الصفوف القائمة — كلها بنطاق الفوج
UPDATE `TuitionFee`
SET `scopeKey` = CONCAT('sub:', `subjectId`, '|grp:', `studyGroupId`, '|lvl:-|stg:-|typ:-')
WHERE `scopeKey` IS NULL;

ALTER TABLE `TuitionFee` MODIFY `scopeKey` VARCHAR(255) NOT NULL;

CREATE UNIQUE INDEX `TuitionFee_scopeKey_effectiveFrom_key` ON `TuitionFee`(`scopeKey`, `effectiveFrom`);

CREATE INDEX `TuitionFee_levelId_idx` ON `TuitionFee`(`levelId`);
CREATE INDEX `TuitionFee_educationStageId_idx` ON `TuitionFee`(`educationStageId`);

ALTER TABLE `TuitionFee` ADD CONSTRAINT `TuitionFee_studyGroupId_fkey`
    FOREIGN KEY (`studyGroupId`) REFERENCES `StudyGroup`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TuitionFee` ADD CONSTRAINT `TuitionFee_levelId_fkey`
    FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TuitionFee` ADD CONSTRAINT `TuitionFee_educationStageId_fkey`
    FOREIGN KEY (`educationStageId`) REFERENCES `EducationStage`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
