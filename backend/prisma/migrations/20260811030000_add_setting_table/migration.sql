-- ------------------------------------------------------
-- جدول الإعدادات — مفتاح / قيمة
--
-- هوية المدرسة (الاسم، الهاتف، العنوان، اللون) تصير بيانات
-- لا ثوابت في الواجهة. القيمة نصّية دائماً وتُفسَّر عند القراءة،
-- فإضافة إعداد جديد لا تحتاج migration.
-- ------------------------------------------------------

CREATE TABLE `Setting` (
    `setting_key` VARCHAR(64) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`setting_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
