-- ------------------------------------------------------
-- السعر بالسنة الدراسية لا بفترة سريان
--
-- كان الصفّ يحمل [effectiveFrom, effectiveTo)، فكان على المستخدم أن
-- يضبط تاريخاً لا يعنيه ليعمل السعر. ومن أخطأه — تسعيرةٌ تبدأ في
-- 2026-12-31 بينما الفواتير لشهر أوت — بقيت الفواتير لا تُولَّد
-- وعمودا المبلغ والمتبقّي فارغَين، بلا سببٍ ظاهر على الشاشة.
--
-- والمؤسسة لا تسعّر بالتواريخ أصلاً بل بالسنة: «سعر 2026/2027».
--
-- وحمايةُ التاريخ المالي لم تكن بالتواريخ يوماً: Invoice.amount
-- و Settlement.tuitionSnapshot ينسخان السعر لحظة الإصدار، فسبتمبر
-- يبقى بسعره ولو رُفع بعده. النسخُ هو الحارس لا فترةُ السريان.
-- ------------------------------------------------------

ALTER TABLE `TuitionFee` ADD COLUMN `academicYearId` VARCHAR(191) NULL;

-- الصفوف القائمة تُنسب إلى السنة الجارية — وهي الوحيدة هنا.
-- وإن تعدّدت السنوات لاحقاً فالجارية أقربُ تخميناً للسعر المُدخل.
UPDATE `TuitionFee`
SET `academicYearId` = (
    SELECT `id` FROM `AcademicYear` WHERE `isCurrent` = 1 ORDER BY `startDate` DESC LIMIT 1
)
WHERE `academicYearId` IS NULL;

-- بلا سنةٍ جارية لا يبقى الصفّ معلَّقاً بلا مرجع
DELETE FROM `TuitionFee` WHERE `academicYearId` IS NULL;

ALTER TABLE `TuitionFee` MODIFY `academicYearId` VARCHAR(191) NOT NULL;

-- البصمة تُعاد بناؤها لتضمّ السنة في مقدّمتها
UPDATE `TuitionFee`
SET `scopeKey` = CONCAT(
    'yr:', `academicYearId`,
    '|sub:', `subjectId`,
    '|grp:', COALESCE(`studyGroupId`, '-'),
    '|lvl:', COALESCE(`levelId`, '-'),
    '|stg:', COALESCE(`educationStageId`, '-'),
    '|typ:', COALESCE(`groupType`, '-')
);

-- الفهرس الجديد قبل إسقاط القديم: القديم سندُ قيدٍ محتمل، والترتيب
-- هنا يجنّب رفض MySQL كما وقع في migration سابقة
CREATE UNIQUE INDEX `TuitionFee_scopeKey_key` ON `TuitionFee`(`scopeKey`);

DROP INDEX `TuitionFee_scopeKey_effectiveFrom_key` ON `TuitionFee`;
DROP INDEX `TuitionFee_effectiveFrom_idx` ON `TuitionFee`;

ALTER TABLE `TuitionFee`
    DROP COLUMN `effectiveFrom`,
    DROP COLUMN `effectiveTo`;

CREATE INDEX `TuitionFee_academicYearId_idx` ON `TuitionFee`(`academicYearId`);

ALTER TABLE `TuitionFee` ADD CONSTRAINT `TuitionFee_academicYearId_fkey`
    FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
