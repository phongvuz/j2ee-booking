ALTER TABLE `trip`
  ADD COLUMN `endsAt` DATETIME(3) NULL,
  ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `driverId` VARCHAR(191) NULL;

UPDATE `trip` SET `status` = 'DEPARTED' WHERE `time` <= CURRENT_TIMESTAMP(3);
UPDATE `booking` SET `pnr` = CONCAT('NHAXE-', `tripId`, '-', `userId`, `id`) WHERE `pnr` IS NULL OR `pnr` = '';

CREATE INDEX `trip_busId_time_endsAt_idx` ON `trip`(`busId`, `time`, `endsAt`);
CREATE INDEX `trip_driverId_time_endsAt_idx` ON `trip`(`driverId`, `time`, `endsAt`);
ALTER TABLE `trip` ADD CONSTRAINT `trip_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `BookingTransaction` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `bookingId` INTEGER NOT NULL,
  `kind` VARCHAR(10) NOT NULL,
  `amount` INTEGER NOT NULL,
  `method` VARCHAR(20) NOT NULL,
  `reference` VARCHAR(64) NOT NULL,
  `actorId` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BookingTransaction_reference_bookingId_key` (`reference`, `bookingId`),
  INDEX `BookingTransaction_bookingId_createdAt_idx` (`bookingId`, `createdAt`),
  INDEX `BookingTransaction_kind_createdAt_idx` (`kind`, `createdAt`),
  CONSTRAINT `BookingTransaction_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `BookingTransaction_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `BookingTransaction_amount_check` CHECK (`amount` > 0),
  CONSTRAINT `BookingTransaction_kind_check` CHECK (`kind` IN ('RECEIPT', 'REFUND')),
  CONSTRAINT `BookingTransaction_method_check` CHECK (`method` IN ('CASH', 'BANK_TRANSFER', 'DEMO', 'LEGACY'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Imported receipts reflect old ticket records, not a new bank verification.
-- Do not invent refunds or a staff identity for historical records.
INSERT INTO `BookingTransaction` (`bookingId`, `kind`, `amount`, `method`, `reference`, `createdAt`)
SELECT b.`id`, 'RECEIPT', b.`totalPrice`,
  CASE WHEN EXISTS (SELECT 1 FROM `Payment` p WHERE p.`pnr` = b.`pnr` AND p.`status` = 'SUCCESS' AND p.`responseCode` = 'DEMO') THEN 'DEMO' ELSE 'LEGACY' END,
  CONCAT('LEGACY-', b.`id`), COALESCE(b.`confirmedAt`, b.`createdAt`)
FROM `booking` b
WHERE (b.`status` = 'CONFIRMED' OR b.`confirmedAt` IS NOT NULL) AND b.`totalPrice` > 0;
