-- ------------------------------------------------------
-- رقم الطالب في المؤسسة
--
-- «2026000147»: أربعُ خاناتٍ لسنة بدء السنة الدراسية التي
-- سُجّل فيها الطالب، ثمّ متسلسلٌ من ستّ خانات داخلها.
--
-- سببُه بطاقةُ الطالب: `id` معرّفٌ داخلي (cuid) بخمسٍ وعشرين
-- محرفاً لا تُملى في هاتف ولا تُقرأ من بطاقة، والباركود يحتاج
-- رقماً يُطبع تحته ويُقرأ بالعين إن عجز الماسح.
--
-- والصفوف القائمة تُرقَّم هنا لا في سكربتٍ منفصل: عمودٌ
-- ‏NOT NULL UNIQUE لا يُضاف على جدولٍ فيه صفوف إلّا بعد ملئه،
-- وتركُه اختيارياً كان سيترك طلبةً بلا بطاقة بلا أن يشتكي أحد.
-- ------------------------------------------------------

ALTER TABLE `Student` ADD COLUMN `studentNumber` VARCHAR(191) NULL;

-- السنةُ من `AcademicYear` التي يقع فيها تاريخ التسجيل، وإلّا
-- فسنةُ التسجيل التقويمية — فطالبٌ سُجّل قبل إنشاء أي سنة
-- دراسية يأخذ رقماً معقولاً بدل أن يبقى فارغاً.
UPDATE `Student` AS s
JOIN (
  SELECT
    t.id,
    CONCAT(
      t.yr,
      LPAD(
        ROW_NUMBER() OVER (PARTITION BY t.yr ORDER BY t.registrationDate, t.id),
        6,
        '0'
      )
    ) AS num
  FROM (
    SELECT
      st.id,
      st.registrationDate,
      COALESCE(
        (
          SELECT YEAR(ay.startDate)
          FROM `AcademicYear` ay
          WHERE st.registrationDate >= ay.startDate
            AND st.registrationDate <= ay.endDate
          ORDER BY ay.startDate
          LIMIT 1
        ),
        YEAR(st.registrationDate)
      ) AS yr
    FROM `Student` st
  ) t
) AS x ON x.id = s.id
SET s.studentNumber = x.num;

ALTER TABLE `Student` MODIFY `studentNumber` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `Student_studentNumber_key` ON `Student`(`studentNumber`);
