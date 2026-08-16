-- ------------------------------------------------------
-- كشف الحضور كيانٌ قائم بذاته
--
-- كان يُشتقّ من نافذة تواريخ، فكان يورث سؤالاً بلا جواب: حصةٌ في مطلع
-- الشهر التالي — أهي ذيلُ هذا الكشف أم مطلعُ الذي يليه؟ السؤال ليس
-- تقويمياً، فالجواب ليس في التقويم. الكشف الآن يملك حصصه صراحةً.
--
-- `sheetId` على Session اختياري: الحصص المولَّدة من الجدول الأسبوعي
-- لا تنتمي إلى كشفٍ حتى تُضمّ إليه، والقائمة منها تبقى كما هي.
-- ------------------------------------------------------

CREATE TABLE `AttendanceSheet` (
    `id` VARCHAR(191) NOT NULL,
    `teachingAssignmentId` VARCHAR(191) NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `label` VARCHAR(191) NULL,
    `sessionCount` INTEGER NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceSheet_teachingAssignmentId_idx`(`teachingAssignmentId`),
    INDEX `AttendanceSheet_academicYearId_idx`(`academicYearId`),
    UNIQUE INDEX `AttendanceSheet_teachingAssignmentId_number_key`(`teachingAssignmentId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AttendanceSheet` ADD CONSTRAINT `AttendanceSheet_teachingAssignmentId_fkey`
    FOREIGN KEY (`teachingAssignmentId`) REFERENCES `TeachingAssignment`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AttendanceSheet` ADD CONSTRAINT `AttendanceSheet_academicYearId_fkey`
    FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Session` ADD COLUMN `sheetId` VARCHAR(191) NULL;

CREATE INDEX `Session_sheetId_idx` ON `Session`(`sheetId`);

ALTER TABLE `Session` ADD CONSTRAINT `Session_sheetId_fkey`
    FOREIGN KEY (`sheetId`) REFERENCES `AttendanceSheet`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
