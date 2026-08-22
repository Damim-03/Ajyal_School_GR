-- ------------------------------------------------------
-- الورقة الموقَّعة صفحاتٌ لا وجهان
--
-- كان المرفق وجهاً من اثنين (FRONT/BACK)، والواقع أنّ الكشف التقديري
-- يطول فيُطبع على ثلاث صفحاتٍ وأربع، وتعود من الأستاذ موقَّعةً كلُّها.
-- فوجهان لا يسعانها، وما زاد كان يُستبدل بما قبله فيضيع.
--
-- فصار **رقمَ صفحة**: واحدٌ فما فوق بلا حدّ، والترتيب هو ترتيب القراءة.
-- والقديم يُنقل بلا فقد: الأمامية صفحةٌ أولى، والخلفية ثانية، وما لا
-- وجهَ له يأخذ ترتيبَه بتاريخ رفعه.
-- ------------------------------------------------------

ALTER TABLE `SettlementDocument`
  ADD COLUMN `pageNumber` INT NOT NULL DEFAULT 1;

-- الأمامية والخلفية أوّلاً — صفتُهما صريحة
UPDATE `SettlementDocument` SET `pageNumber` = 1 WHERE `side` = 'FRONT';
UPDATE `SettlementDocument` SET `pageNumber` = 2 WHERE `side` = 'BACK';

-- وما لا وجهَ له: ترتيبُه بتاريخ رفعه بعد ما له وجه
UPDATE `SettlementDocument` AS d
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (PARTITION BY `settlementId` ORDER BY `createdAt`, `id`) AS `seq`,
    (SELECT COUNT(*) FROM `SettlementDocument` AS x
      WHERE x.`settlementId` = s.`settlementId` AND x.`side` IS NOT NULL) AS `taken`
  FROM `SettlementDocument` AS s
  WHERE s.`side` IS NULL
) AS ordered ON ordered.`id` = d.`id`
SET d.`pageNumber` = ordered.`taken` + ordered.`seq`;

ALTER TABLE `SettlementDocument` DROP COLUMN `side`;

CREATE INDEX `SettlementDocument_settlementId_pageNumber_idx`
  ON `SettlementDocument`(`settlementId`, `pageNumber`);
