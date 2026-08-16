-- ربطُ الفاتورة بكشفها — إضافةٌ اختيارية لا تمسّ صفّاً قائماً.
--
-- الفارغ يعني «لم يُحدَّد بلا لبس»: كشفٌ يمتدّ على شهرين أو شهرٌ
-- يتقاسمه كشفان يتركانه فارغاً بدل أن يُخمَّن.
--
-- و`ON DELETE SET NULL`: حذفُ الكشف يمحو حصصه وحضورَها ولا يمسّ
-- الفاتورة — يفكّ نسبتَها إليه فقط. فالمالُ يبقى وإن مُحيت ورقتُه.

ALTER TABLE `Invoice`
  ADD COLUMN `attendanceSheetId` VARCHAR(191) NULL;

CREATE INDEX `Invoice_attendanceSheetId_idx` ON `Invoice`(`attendanceSheetId`);

ALTER TABLE `Invoice`
  ADD CONSTRAINT `Invoice_attendanceSheetId_fkey`
  FOREIGN KEY (`attendanceSheetId`) REFERENCES `AttendanceSheet`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
