-- ------------------------------------------------------
-- مستوى الطالب — حقلٌ عليه لا اشتقاقٌ من تسجيلاته
--
-- كان المستوى يُقرأ عبر التسجيل ← الإسناد ← الفوج ← المستوى.
-- وذلك يعطي إجاباتٍ عدّة لطالبٍ يدرس ثلاث مواد في ثلاثة أفواج،
-- ولا يعطي شيئاً لطالبٍ سُجّل للتوّ ولم يُسنَد بعد — وهي اللحظة
-- التي تُطبع فيها بطاقته، فتخرج بـ«المستوى: —».
--
-- والحقل قابلٌ للفراغ: الصفوف القائمة سبقته، وتُملأ بالعبارة
-- التالية من مستوى أفواجها. وما لا تسجيل له يبقى فارغاً حتى
-- يُحرَّر من شاشة الطالب.
--
-- ولا عمود للطور: `Level.educationStageId` يحمله، وتخزينه
-- مرّتين يفتح باب التناقض بين طورٍ ومستوًى لا ينتمي إليه.
-- ------------------------------------------------------

ALTER TABLE `Student` ADD COLUMN `levelId` VARCHAR(191) NULL;

CREATE INDEX `Student_levelId_idx` ON `Student`(`levelId`);

ALTER TABLE `Student`
  ADD CONSTRAINT `Student_levelId_fkey`
  FOREIGN KEY (`levelId`) REFERENCES `Level`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------
-- تعبئة رجعية — مستوى أفواج الطالب الحالية
--
-- يُؤخذ من التسجيل النشط في السنة الجارية أوّلاً، وإلّا فأحدثُ
-- نشط، وإلّا فأحدثُ ما وُجد — وهو ترتيب `schoolingOf` نفسه في
-- الواجهة، فلا تتبدّل بطاقةٌ مطبوعةٌ سلفاً.
--
-- والمستوى واحدٌ عملياً مهما تعدّدت الأفواج: كلُّها تحت مستوى
-- الطالب. فإن تعدّدت المستويات (بيانات مغلوطة) يُؤخذ الأوّل
-- بهذا الترتيب وتُصحَّح يدوياً.
-- ------------------------------------------------------

UPDATE `Student` s
SET s.`levelId` = (
  SELECT g.`levelId`
  FROM `StudentEnrollment` e
  JOIN `TeachingAssignment` ta ON ta.`id` = e.`teachingAssignmentId`
  JOIN `StudyGroup` g         ON g.`id`  = ta.`studyGroupId`
  JOIN `AcademicYear` y       ON y.`id`  = ta.`academicYearId`
  WHERE e.`studentId` = s.`id`
  ORDER BY
    (e.`isActive` = 1 AND y.`isCurrent` = 1) DESC,
    e.`isActive` DESC,
    e.`enrolledAt` DESC
  LIMIT 1
)
WHERE s.`levelId` IS NULL;
