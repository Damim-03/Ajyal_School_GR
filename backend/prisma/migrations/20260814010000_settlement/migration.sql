-- ------------------------------------------------------
-- تخليص الأستاذ — الجانب الغائب من النظام المالي
--
-- ما يدفعه الطالب ليس ما يقبضه الأستاذ، ولا علاقة ثابتة بينهما إلا
-- ما تقرّره الإدارة. فلا نسبةَ ولا مبلغَ في الكود: SettlementPolicy
-- تحمل الطريقة وقيمتها، وSettlement يحمل نسخةً منهما لحظة الحساب.
--
-- ووحدةُ التخليص كشفُ الحضور لا الشهر التقويمي: «الشهر: 4» في
-- الورقة رقمُ كشفٍ، والأستاذ يُخلَّص عن كشفٍ امتلأ بحصصه.
-- ------------------------------------------------------

CREATE TABLE `SettlementPolicy` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `method` ENUM('PERCENTAGE', 'PER_STUDENT', 'PER_SESSION', 'PER_ATTENDED_SHARE') NOT NULL,
    `teacherPercentage` DECIMAL(5, 2) NULL,
    `amountPerStudent` DECIMAL(10, 2) NULL,
    `amountPerSession` DECIMAL(10, 2) NULL,
    `countBasis` ENUM('ENROLLED', 'PAID', 'PRESENT') NOT NULL DEFAULT 'ENROLLED',
    `roundingMode` ENUM('ROUND', 'ROUND_UP', 'ROUND_DOWN') NOT NULL DEFAULT 'ROUND',
    `roundingPrecision` INTEGER NOT NULL DEFAULT 2,
    `academicYearId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NULL,
    `studyGroupId` VARCHAR(191) NULL,
    `teacherId` VARCHAR(191) NULL,
    `scopeKey` VARCHAR(255) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `effectiveTo` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SettlementPolicy_scopeKey_effectiveFrom_key`(`scopeKey`, `effectiveFrom`),
    INDEX `SettlementPolicy_academicYearId_idx`(`academicYearId`),
    INDEX `SettlementPolicy_teacherId_idx`(`teacherId`),
    INDEX `SettlementPolicy_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- كلُّ ما دخل الحساب منسوخٌ هنا لا مقروءاً من مصدره وقت العرض،
-- فتغييرُ السياسة أو التسعيرة غداً لا يمسّ تخليصاً حُسب اليوم.
CREATE TABLE `Settlement` (
    `id` VARCHAR(191) NOT NULL,
    `settlementNumber` VARCHAR(191) NOT NULL,
    `teachingAssignmentId` VARCHAR(191) NOT NULL,
    `attendanceSheetId` VARCHAR(191) NOT NULL,
    `academicYearId` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `policyId` VARCHAR(191) NOT NULL,
    `methodSnapshot` ENUM('PERCENTAGE', 'PER_STUDENT', 'PER_SESSION', 'PER_ATTENDED_SHARE') NOT NULL,
    `countBasisSnapshot` ENUM('ENROLLED', 'PAID', 'PRESENT') NOT NULL,
    `roundingModeSnapshot` ENUM('ROUND', 'ROUND_UP', 'ROUND_DOWN') NOT NULL,
    `roundingPrecisionSnapshot` INTEGER NOT NULL,
    `percentageSnapshot` DECIMAL(5, 2) NULL,
    `perStudentSnapshot` DECIMAL(10, 2) NULL,
    `perSessionSnapshot` DECIMAL(10, 2) NULL,
    `tuitionSnapshot` DECIMAL(10, 2) NOT NULL,
    `approvedSessionsSnapshot` INTEGER NOT NULL,
    `completedSessionsSnapshot` INTEGER NOT NULL,
    `studentCountSnapshot` INTEGER NOT NULL,
    `paidStudentCountSnapshot` INTEGER NOT NULL,
    `attendedUnitsSnapshot` INTEGER NOT NULL,
    `grossTuitionSnapshot` DECIMAL(12, 2) NOT NULL,
    `collectedSnapshot` DECIMAL(12, 2) NOT NULL,
    `remainingSnapshot` DECIMAL(12, 2) NOT NULL,
    `teacherAmount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `computedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    `confirmedById` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `paidById` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledById` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Settlement_settlementNumber_key`(`settlementNumber`),
    UNIQUE INDEX `Settlement_teachingAssignmentId_attendanceSheetId_key`(`teachingAssignmentId`, `attendanceSheetId`),
    INDEX `Settlement_teacherId_idx`(`teacherId`),
    INDEX `Settlement_academicYearId_idx`(`academicYearId`),
    INDEX `Settlement_status_idx`(`status`),
    INDEX `Settlement_attendanceSheetId_idx`(`attendanceSheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- سطرٌ لكل حصة — هو نفسه «الكشف التقديري» مخزَّناً. تخزينُه لا
-- اشتقاقُه عند الطباعة هو ما يجعل الورقة المطبوعة اليوم مطابقةً
-- لنسختها بعد سنة. و rate بأربع منازل لأن قسمة الحقّ على الحصص
-- تُنتج كسوراً (1500 ÷ 8 × 75% = 140.625) لا تحتمل التقريب قبل
-- ضربها في عدد الحضور.
CREATE TABLE `SettlementLine` (
    `id` VARCHAR(191) NOT NULL,
    `settlementId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `lessonNumber` INTEGER NOT NULL,
    `sessionDate` DATETIME(3) NULL,
    `countedStudents` INTEGER NOT NULL,
    `rate` DECIMAL(10, 4) NOT NULL,
    `lineTotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SettlementLine_settlementId_idx`(`settlementId`),
    INDEX `SettlementLine_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- أثر التغيير المالي.
--
-- آثارُ الإلغاء على الفاتورة والدفعة تجيب عن «مَن ألغى ولماذا»،
-- لكنها لا تجيب عن «كم كان السعر قبل أن يُرفع».
--
-- entity نصٌّ لا مفتاح أجنبي عمداً: السجل يبقى بعد حذف موضوعه،
-- وسجلُّ تدقيقٍ يُحذف مع ما يدقّقه لا معنى له.
CREATE TABLE `FinancialAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'CANCEL', 'CONFIRM', 'RECOMPUTE') NOT NULL,
    `field` VARCHAR(64) NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `reason` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FinancialAuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `FinancialAuditLog_userId_idx`(`userId`),
    INDEX `FinancialAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SettlementPolicy` ADD CONSTRAINT `SettlementPolicy_academicYearId_fkey`
    FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SettlementPolicy` ADD CONSTRAINT `SettlementPolicy_subjectId_fkey`
    FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SettlementPolicy` ADD CONSTRAINT `SettlementPolicy_studyGroupId_fkey`
    FOREIGN KEY (`studyGroupId`) REFERENCES `StudyGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SettlementPolicy` ADD CONSTRAINT `SettlementPolicy_teacherId_fkey`
    FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_teachingAssignmentId_fkey`
    FOREIGN KEY (`teachingAssignmentId`) REFERENCES `TeachingAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_attendanceSheetId_fkey`
    FOREIGN KEY (`attendanceSheetId`) REFERENCES `AttendanceSheet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_academicYearId_fkey`
    FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_teacherId_fkey`
    FOREIGN KEY (`teacherId`) REFERENCES `Teacher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_policyId_fkey`
    FOREIGN KEY (`policyId`) REFERENCES `SettlementPolicy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_confirmedById_fkey`
    FOREIGN KEY (`confirmedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_paidById_fkey`
    FOREIGN KEY (`paidById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Settlement` ADD CONSTRAINT `Settlement_cancelledById_fkey`
    FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SettlementLine` ADD CONSTRAINT `SettlementLine_settlementId_fkey`
    FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SettlementLine` ADD CONSTRAINT `SettlementLine_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `FinancialAuditLog` ADD CONSTRAINT `FinancialAuditLog_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
