-- ------------------------------------------------------
-- 1. LessonSlot مربوط بالسنة الدراسية
--
-- العمود يُضاف NULL أولاً لتُملأ الصفوف القائمة بالسنة الحالية،
-- ثم يصير NOT NULL. الترتيب يصير فريداً داخل السنة لا عبر السنوات.
-- ------------------------------------------------------

ALTER TABLE `LessonSlot` ADD COLUMN `academicYearId` VARCHAR(191) NULL;

UPDATE `LessonSlot`
SET `academicYearId` = (
  SELECT `id` FROM `AcademicYear` ORDER BY `isCurrent` DESC, `startDate` DESC LIMIT 1
)
WHERE `academicYearId` IS NULL;

ALTER TABLE `LessonSlot` MODIFY `academicYearId` VARCHAR(191) NOT NULL;

DROP INDEX `LessonSlot_order_key` ON `LessonSlot`;

CREATE UNIQUE INDEX `LessonSlot_academicYearId_order_key` ON `LessonSlot`(`academicYearId`, `order`);

CREATE INDEX `LessonSlot_academicYearId_idx` ON `LessonSlot`(`academicYearId`);

ALTER TABLE `LessonSlot`
  ADD CONSTRAINT `LessonSlot_academicYearId_fkey`
  FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------
-- 2. أثر الإلغاء على السجلات المالية
--
-- العمليات المالية تُلغى ولا تُحذف، فيلزم توثيق مَن ألغى ومتى ولماذا.
-- ------------------------------------------------------

ALTER TABLE `Invoice`
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `cancelledById` VARCHAR(191) NULL,
  ADD COLUMN `cancelReason` VARCHAR(191) NULL;

ALTER TABLE `Payment`
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `cancelledById` VARCHAR(191) NULL,
  ADD COLUMN `cancelReason` VARCHAR(191) NULL;

ALTER TABLE `Receipt`
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `cancelledById` VARCHAR(191) NULL,
  ADD COLUMN `cancelReason` VARCHAR(191) NULL;

ALTER TABLE `Invoice`
  ADD CONSTRAINT `Invoice_cancelledById_fkey`
  FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_cancelledById_fkey`
  FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Receipt`
  ADD CONSTRAINT `Receipt_cancelledById_fkey`
  FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
