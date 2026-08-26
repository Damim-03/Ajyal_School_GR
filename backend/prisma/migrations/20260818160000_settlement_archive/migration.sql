-- ------------------------------------------------------
-- أرشيف التخليص — الورقة الموقَّعة واللقطة المجمَّدة
--
-- إثبات الدفع للأستاذ لم يكن يترك أثراً يُرجع إليه: التخليص يحفظ
-- الحساب، لكنّ كشف الحضور وكشف الحقوق معطياتُهما حيّة — حضورٌ
-- يُصحَّح بعد شهر، ودَينٌ يُسدَّد — فتتبدّل الورقة التي وُقّع عليها.
--
-- فجدولان: واحدٌ للأوراق الممسوحة (الإقرار الموقَّع)، وآخر للّقطة
-- المجمَّدة (‏JSON) لحظة الدفع.
--
-- ومعهما صلاحيات دفع الأستاذ: نماذجُه في المخطّط منذ البداية بلا
-- مسارات، فتُفتح الآن.
-- ------------------------------------------------------

CREATE TABLE `SettlementDocument` (
  `id`           VARCHAR(191) NOT NULL,
  `settlementId` VARCHAR(191) NOT NULL,
  `filePath`     VARCHAR(191) NOT NULL,
  `fileName`     VARCHAR(191) NULL,
  `note`         VARCHAR(191) NULL,
  `uploadedById` VARCHAR(191) NULL,
  `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `SettlementDocument_settlementId_idx` (`settlementId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SettlementSnapshot` (
  `id`           VARCHAR(191) NOT NULL,
  `settlementId` VARCHAR(191) NOT NULL,
  `dailySheet`   JSON NOT NULL,
  `monthlyFees`  JSON NOT NULL,
  `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `SettlementSnapshot_settlementId_key` (`settlementId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SettlementDocument`
  ADD CONSTRAINT `SettlementDocument_settlementId_fkey`
  FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SettlementDocument`
  ADD CONSTRAINT `SettlementDocument_uploadedById_fkey`
  FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SettlementSnapshot`
  ADD CONSTRAINT `SettlementSnapshot_settlementId_fkey`
  FOREIGN KEY (`settlementId`) REFERENCES `Settlement`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------
-- الصلاحيات
--
-- `hasPermission` في الواجهة مطابقةٌ نصّية تامّة بلا wildcard حتى
-- لـADMIN، فالزرّ يختفي بصمت إن لم يُنشأ اسمُه هنا.
--
-- و`MAINTENANCE` مذكورةٌ هنا وإن كانت الهجرةُ التي أدخلتها لاحقةً
-- (‏20260822090000). والسبب أنّ `MODIFY ... ENUM` **يقصّ** كلَّ صفٍّ
-- يحمل قيمةً خارج القائمة: يُفرغه إلى '' في الوضع المتساهل، ويسقط
-- بالخطأ 1265 في `STRICT_TRANS_TABLES` — وهو الافتراضيُّ على أكثر
-- الاستضافات.
--
-- وليس هذا احتمالاً نظرياً: `provisionRbac` يُنشئ صلاحيّات
-- `maintenance.*` عند التهيئة الأولى، فإن سبقت التهيئةُ الهجراتِ
-- — وهو ما يقع كلّما أقلع التطبيقُ قبل اكتمالها — وجدت هذه العبارةُ
-- صفوفاً بموديولٍ لا تعرفه فسقطت، وسقط معها كلُّ ما بعدها.
--
-- فذكرُها هنا يجعل العبارةَ توسيعاً دائماً لا تضييقاً، والهجرةُ
-- 20260822090000 تُعيد القائمةَ نفسَها بلا أثر.
-- ------------------------------------------------------

ALTER TABLE `Permission` MODIFY `module` ENUM(
  'STUDENT','TEACHER','TEACHING_ASSIGNMENT','ENROLLMENT','SUBJECT','STUDY_GROUP',
  'LEVEL','EDUCATION_STAGE','ACADEMIC_YEAR','SCHEDULE','SESSION','ATTENDANCE',
  'INVOICE','PAYMENT','RECEIPT','REPORT','USER','ROLE','SETTINGS','CLASSROOM',
  'LESSON_SLOT','TUITION_FEE','SETTLEMENT_POLICY','SETTLEMENT','TEACHER_PAYMENT',
  'MAINTENANCE'
) NOT NULL;

INSERT INTO `Permission` (`id`, `name`, `module`, `description`, `createdAt`, `updatedAt`)
VALUES
  (UUID(), 'teacher-payment.view',   'TEACHER_PAYMENT', 'view teacher payments',   NOW(3), NOW(3)),
  (UUID(), 'teacher-payment.create', 'TEACHER_PAYMENT', 'pay a teacher',           NOW(3), NOW(3)),
  (UUID(), 'teacher-payment.cancel', 'TEACHER_PAYMENT', 'cancel a teacher payment', NOW(3), NOW(3)),
  (UUID(), 'settlement.document',    'SETTLEMENT',      'attach signed settlement papers', NOW(3), NOW(3));

-- الأدوار التي تمسّ المال: المدير والمحاسب — كما في بقية صلاحيات التخليص
INSERT INTO `RolePermission` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `Role` r
JOIN `Permission` p
  ON p.`name` IN (
    'teacher-payment.view',
    'teacher-payment.create',
    'teacher-payment.cancel',
    'settlement.document'
  )
WHERE r.`name` IN ('ADMIN', 'ACCOUNTANT', 'MANAGER')
  AND NOT EXISTS (
    SELECT 1 FROM `RolePermission` rp
    WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
  );
