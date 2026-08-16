-- ------------------------------------------------------
-- توسيع PermissionModule بموديولَي التخليص
--
-- إضافةُ قيمةٍ إلى enum في schema.prisma لا تكفي: العمود في MySQL
-- من نوع ENUM بقائمةٍ محفوظة في تعريف الجدول، وما لم يُوسَّع فإن
-- الإدخال يُرفض — أو يُحفظ سلسلةً فارغة في الوضع غير الصارم، فتصير
-- القراءة نفسها خطأ.
--
-- الترتيب هنا يطابق ترتيب الـ enum في المخطّط. مخالفتُه لا تكسر
-- شيئاً وظيفياً لكنها تُظهر انحرافاً في كل `migrate diff` لاحق.
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
    'TUITION_FEE',
    'SETTLEMENT_POLICY',
    'SETTLEMENT'
) NOT NULL;
