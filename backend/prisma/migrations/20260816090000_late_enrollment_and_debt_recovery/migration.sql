-- الالتحاق المتأخّر وتحصيل الديون
--
-- إضافةٌ محضة: لا عمودٌ يُحذف ولا نوعٌ يتغيّر ولا صفٌّ يُمَسّ.
-- وكلُّ عمودٍ جديدٍ على جدولٍ قائم إمّا NULL أو له قيمة افتراضية
-- تُبقي السلوك السابق كما هو:
--   StudentEnrollment.eligibleFrom = NULL  →  مؤهَّلٌ من البداية
--   Invoice.approvedSessions/… = NULL      →  شهرٌ كامل
--   TuitionFee.lateEnrollmentMode          →  لا أثر له ما لم يُملأ eligibleFrom

-- ============ 1) الالتحاق المتأخّر ============

ALTER TABLE `StudentEnrollment`
  ADD COLUMN `eligibleFrom` DATETIME(3) NULL;

ALTER TABLE `TuitionFee`
  ADD COLUMN `lateEnrollmentMode` ENUM('FULL_MONTH','PRORATED_BY_REMAINING_SESSIONS')
    NOT NULL DEFAULT 'PRORATED_BY_REMAINING_SESSIONS';

ALTER TABLE `Invoice`
  ADD COLUMN `approvedSessions` INT NULL,
  ADD COLUMN `eligibleSessions` INT NULL,
  ADD COLUMN `sessionRate` DECIMAL(12,4) NULL;

-- ============ 2) قواعد الدين في سياسة التخليص ============

ALTER TABLE `SettlementPolicy`
  ADD COLUMN `debtSettlementBasis` ENUM('ORIGINAL_PERIOD','COLLECTION_PERIOD','EXCLUDED')
    NOT NULL DEFAULT 'COLLECTION_PERIOD',
  ADD COLUMN `debtShareBasis` ENUM('ATTENDED_UNITS','COLLECTED_AMOUNT')
    NOT NULL DEFAULT 'ATTENDED_UNITS';

-- ============ 3) تحصيل الديون وحصة الأستاذ ============

CREATE TABLE `DebtCollection` (
  `id` VARCHAR(191) NOT NULL,
  `invoiceId` VARCHAR(191) NOT NULL,
  `paymentId` VARCHAR(191) NOT NULL,
  `collectedAmount` DECIMAL(12,2) NOT NULL,
  `originalMonth` INT NOT NULL,
  `originalYear` INT NOT NULL,
  `collectedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DebtCollection_invoiceId_paymentId_key`(`invoiceId`, `paymentId`),
  INDEX `DebtCollection_collectedAt_idx`(`collectedAt`),
  INDEX `DebtCollection_originalYear_originalMonth_idx`(`originalYear`, `originalMonth`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TeacherDebtShare` (
  `id` VARCHAR(191) NOT NULL,
  `teacherId` VARCHAR(191) NOT NULL,
  `debtCollectionId` VARCHAR(191) NOT NULL,
  `originalSettlementId` VARCHAR(191) NULL,
  `collectionSettlementId` VARCHAR(191) NULL,
  `basisSnapshot` ENUM('ATTENDED_UNITS','COLLECTED_AMOUNT') NOT NULL,
  `percentageSnapshot` DECIMAL(5,2) NOT NULL,
  `unitRateSnapshot` DECIMAL(12,4) NULL,
  `attendedUnits` INT NULL,
  `collectedAmount` DECIMAL(12,2) NOT NULL,
  `shareAmount` DECIMAL(12,2) NOT NULL,
  `status` ENUM('PENDING','APPROVED','PAID','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `approvedAt` DATETIME(3) NULL,
  `approvedById` VARCHAR(191) NULL,
  `paidAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelReason` VARCHAR(191) NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TeacherDebtShare_debtCollectionId_key`(`debtCollectionId`),
  INDEX `TeacherDebtShare_teacherId_status_idx`(`teacherId`, `status`),
  INDEX `TeacherDebtShare_collectionSettlementId_idx`(`collectionSettlementId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TeacherPayment` (
  `id` VARCHAR(191) NOT NULL,
  `paymentNumber` VARCHAR(191) NOT NULL,
  `teacherId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `paymentMethod` ENUM('CASH','CARD','BANK_TRANSFER') NOT NULL DEFAULT 'CASH',
  `paymentDate` DATETIME(3) NOT NULL,
  `reference` VARCHAR(191) NULL,
  `note` VARCHAR(191) NULL,
  `status` ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `paidById` VARCHAR(191) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancelledById` VARCHAR(191) NULL,
  `cancelReason` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TeacherPayment_paymentNumber_key`(`paymentNumber`),
  INDEX `TeacherPayment_teacherId_idx`(`teacherId`),
  INDEX `TeacherPayment_paymentDate_idx`(`paymentDate`),
  INDEX `TeacherPayment_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TeacherPaymentAllocation` (
  `id` VARCHAR(191) NOT NULL,
  `teacherPaymentId` VARCHAR(191) NOT NULL,
  `settlementId` VARCHAR(191) NULL,
  `teacherDebtShareId` VARCHAR(191) NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  UNIQUE INDEX `TPA_payment_settlement_key`(`teacherPaymentId`, `settlementId`),
  UNIQUE INDEX `TPA_payment_debtShare_key`(`teacherPaymentId`, `teacherDebtShareId`),
  INDEX `TeacherPaymentAllocation_settlementId_idx`(`settlementId`),
  INDEX `TeacherPaymentAllocation_teacherDebtShareId_idx`(`teacherDebtShareId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============ 4) المفاتيح الأجنبية ============

ALTER TABLE `DebtCollection`
  ADD CONSTRAINT `DebtCollection_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `DebtCollection_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TeacherDebtShare`
  ADD CONSTRAINT `TeacherDebtShare_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `TeacherDebtShare_debtCollectionId_fkey` FOREIGN KEY (`debtCollectionId`) REFERENCES `DebtCollection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `TeacherDebtShare_originalSettlementId_fkey` FOREIGN KEY (`originalSettlementId`) REFERENCES `Settlement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `TeacherDebtShare_collectionSettlementId_fkey` FOREIGN KEY (`collectionSettlementId`) REFERENCES `Settlement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `TeacherDebtShare_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `TeacherPayment`
  ADD CONSTRAINT `TeacherPayment_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `TeacherPayment_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `TeacherPayment_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `TeacherPaymentAllocation`
  ADD CONSTRAINT `TPA_teacherPaymentId_fkey` FOREIGN KEY (`teacherPaymentId`) REFERENCES `TeacherPayment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `TPA_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `TPA_teacherDebtShareId_fkey` FOREIGN KEY (`teacherDebtShareId`) REFERENCES `TeacherDebtShare`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
