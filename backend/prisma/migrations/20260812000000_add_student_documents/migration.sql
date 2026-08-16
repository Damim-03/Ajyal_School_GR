-- ------------------------------------------------------
-- وثائق ملف الطالب
--
-- وثيقة واحدة لكل نوع لكل طالب: إعادة الرفع تستبدل ولا
-- تُراكم، فيصير «هل الملف مكتمل؟» مقارنةً بين الأنواع
-- الموجودة والأنواع المطلوبة.
-- ------------------------------------------------------

CREATE TABLE `StudentDocument` (
    `id` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentDocument_studentId_idx`(`studentId`),
    INDEX `StudentDocument_type_idx`(`type`),
    UNIQUE INDEX `StudentDocument_studentId_type_key`(`studentId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `StudentDocument` ADD CONSTRAINT `StudentDocument_studentId_fkey`
    FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StudentDocument` ADD CONSTRAINT `StudentDocument_uploadedById_fkey`
    FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
