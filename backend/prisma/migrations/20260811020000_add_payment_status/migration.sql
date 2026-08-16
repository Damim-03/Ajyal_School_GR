-- ------------------------------------------------------
-- حالة الدفعة
--
-- الدفعة سجل مالي لا يُحذف. الإلغاء يضبط status = CANCELLED
-- وتبقى صفوف PaymentInvoice للتدقيق، على أن يستثني كل
-- حساب للمدفوع الدفعاتِ الملغاة (service layer).
-- ------------------------------------------------------

ALTER TABLE `Payment`
    ADD COLUMN `status` ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX `Payment_status_idx` ON `Payment`(`status`);
