-- ------------------------------------------------------
-- إضافة TEACHING_ASSIGNMENT إلى PermissionModule
--
-- الإسناد التدريسي (أستاذ + مادة + فوج + سنة) مورد مستقل
-- يحتاج صلاحياته الخاصة، ولم يكن له تصنيف في الـ enum.
-- ------------------------------------------------------

ALTER TABLE `Permission` MODIFY `module` ENUM(
    'STUDENT',
    'TEACHER',
    'TEACHING_ASSIGNMENT',
    'ENROLLMENT',
    'SUBJECT',
    'STUDY_GROUP',
    'LEVEL',
    'EDUCATION_STAGE',
    'ACADEMIC_YEAR',
    'SCHEDULE',
    'SESSION',
    'ATTENDANCE',
    'INVOICE',
    'PAYMENT',
    'RECEIPT',
    'REPORT',
    'USER',
    'ROLE',
    'SETTINGS',
    'CLASSROOM',
    'LESSON_SLOT',
    'TUITION_FEE'
) NOT NULL;
