-- ------------------------------------------------------
-- وثائقُ ملفّ الأستاذ
--
-- ملفُّ التوظيف ورقٌ يُسلَّم يوم التعيين ويُسأل عنه بعد سنة: أين نسخةُ
-- الشهادة؟ ومتى سُلّمت صحيفةُ السوابق؟ وكان الجوابُ في درجٍ لا في
-- النظام، فبقيت شهادةُ العمل تُحرَّر بلا ذكرِ ما سُلّم.
--
-- والجدولُ صنوُ `StudentDocument` في بنيته، ويفترق عنه بعمود `label`:
-- أنواعُ وثائق الطالب مغلقةٌ في الشيفرة، وهذه تفتحها الإدارة بنوعٍ
-- مفتاحُه `custom_…` وتسميتُه من عندها — والتسميةُ تُحفظ في الصفّ لأنّه
-- لا كتالوجَ في الشيفرة يحملها.
--
-- و`@@unique([teacherId, type])` يجعل الرفعَ استبدالاً لا تراكماً:
-- نسخةٌ واحدة لكلّ نوع، وإعادةُ الرفع تُحلّ محلَّ سابقتها.
-- ------------------------------------------------------

CREATE TABLE `TeacherDocument` (
    `id`           VARCHAR(191) NOT NULL,
    `teacherId`    VARCHAR(191) NOT NULL,
    `type`         VARCHAR(64)  NOT NULL,
    `label`        VARCHAR(80)  NULL,
    `filePath`     VARCHAR(191) NOT NULL,
    `fileName`     VARCHAR(191) NULL,
    `note`         VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`    DATETIME(3)  NOT NULL,

    UNIQUE INDEX `TeacherDocument_teacherId_type_key`(`teacherId`, `type`),
    INDEX `TeacherDocument_teacherId_idx`(`teacherId`),
    INDEX `TeacherDocument_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TeacherDocument`
  ADD CONSTRAINT `TeacherDocument_teacherId_fkey`
  FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TeacherDocument`
  ADD CONSTRAINT `TeacherDocument_uploadedById_fkey`
  FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
