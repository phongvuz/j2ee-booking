ALTER TABLE `booking` ADD COLUMN `confirmedAt` DATETIME(3) NULL;
UPDATE `booking` SET `confirmedAt` = `createdAt` WHERE `status` = 'CONFIRMED';
CREATE INDEX `booking_status_confirmedAt_idx` ON `booking`(`status`, `confirmedAt`);
