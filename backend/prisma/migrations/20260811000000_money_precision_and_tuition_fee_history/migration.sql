-- ------------------------------------------------------
-- 1. دقّة المبالغ المالية
--
-- كانت الحقول Decimal بلا @db.Decimal فولّد Prisma عمود
-- DECIMAL(65, 30) — ثلاثون خانة عشرية لمبلغ بالدينار.
-- التصحيح: DECIMAL(10, 2)
-- ------------------------------------------------------

ALTER TABLE `Invoice`
    MODIFY `amount` DECIMAL(10, 2) NOT NULL,
    MODIFY `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    MODIFY `total` DECIMAL(10, 2) NOT NULL,
    MODIFY `remaining` DECIMAL(10, 2) NOT NULL;

ALTER TABLE `Payment` MODIFY `amount` DECIMAL(10, 2) NOT NULL;

ALTER TABLE `PaymentInvoice` MODIFY `paidAmount` DECIMAL(10, 2) NOT NULL;

ALTER TABLE `Teacher` MODIFY `salary` DECIMAL(10, 2) NULL;

ALTER TABLE `TuitionFee` MODIFY `amount` DECIMAL(10, 2) NOT NULL;

-- ------------------------------------------------------
-- 2. تاريخ أسعار حقوق الاشتراك
--
-- القيد القديم @@unique([subjectId, studyGroupId]) كان يسمح
-- بصف واحد فقط لكل (مادة + فوج)، ما يُبطل معنى الحقلين
-- effectiveFrom / effectiveTo. القيد الجديد يضمّ تاريخ البداية.
--
-- نُسقط المفتاح الأجنبي على subjectId قبل حذف الفهرس الفريد
-- ثم نُعيده، لأن MySQL قد يعتمد ذلك الفهرس للمفتاح الأجنبي.
-- ------------------------------------------------------

ALTER TABLE `TuitionFee` DROP FOREIGN KEY `TuitionFee_subjectId_fkey`;

DROP INDEX `TuitionFee_subjectId_studyGroupId_key` ON `TuitionFee`;

CREATE UNIQUE INDEX `TuitionFee_subjectId_studyGroupId_effectiveFrom_key`
    ON `TuitionFee`(`subjectId`, `studyGroupId`, `effectiveFrom`);

CREATE INDEX `TuitionFee_effectiveFrom_idx` ON `TuitionFee`(`effectiveFrom`);

ALTER TABLE `TuitionFee` ADD CONSTRAINT `TuitionFee_subjectId_fkey`
    FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
