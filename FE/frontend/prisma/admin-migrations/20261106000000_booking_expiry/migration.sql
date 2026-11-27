ALTER TABLE `booking`
  ADD COLUMN `expiresAt` DATETIME(3) NULL;

CREATE INDEX `booking_status_expiresAt_idx`
  ON `booking`(`status`, `expiresAt`);