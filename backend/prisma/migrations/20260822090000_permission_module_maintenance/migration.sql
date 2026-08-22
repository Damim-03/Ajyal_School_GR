-- ------------------------------------------------------
-- وحدةُ الصيانة في تعداد الصلاحيات
--
-- النسخُ والاستعادة وإعادة التهيئة أفعالٌ لا تُشبه غيرها: واحدةٌ منها
-- تمحو المؤسسة. فلا تُلحَق بـ`settings.update` — من يُعدّل اسمَ
-- المدرسة ليس بالضرورة من يُؤذَن له بمحوها.
-- ------------------------------------------------------

ALTER TABLE `Permission`
  MODIFY `module` ENUM(
    'STUDENT','TEACHER','TEACHING_ASSIGNMENT','ENROLLMENT','SUBJECT','STUDY_GROUP',
    'LEVEL','EDUCATION_STAGE','ACADEMIC_YEAR','SCHEDULE','SESSION','ATTENDANCE',
    'INVOICE','PAYMENT','RECEIPT','REPORT','USER','ROLE','SETTINGS','CLASSROOM',
    'LESSON_SLOT','TUITION_FEE','SETTLEMENT_POLICY','SETTLEMENT','TEACHER_PAYMENT',
    'MAINTENANCE'
  ) NOT NULL;
