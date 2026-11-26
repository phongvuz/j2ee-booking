-- Dữ liệu cũ được giữ lại. Script db:upgrade kiểm tra xung đột trước migration.
ALTER TABLE `trip` ADD COLUMN `capacity` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `booking`
  ADD COLUMN `pnr` VARCHAR(191) NULL,
  ADD COLUMN `passengerName` VARCHAR(191) NULL,
  ADD COLUMN `passengerPhone` VARCHAR(191) NULL,
  ADD COLUMN `activeSeat` VARCHAR(191) NULL;

-- Chuẩn hóa A1 / A01 / 1A01 về cùng mã ghế A01.
UPDATE `booking` SET `seatNumber` = UPPER(TRIM(`seatNumber`));
UPDATE `booking` SET `seatNumber` = SUBSTRING(`seatNumber`, 2)
  WHERE LEFT(`seatNumber`, 1) IN ('1', '2') AND SUBSTRING(`seatNumber`, 2, 1) IN ('A', 'B', 'C');
UPDATE `booking` SET `seatNumber` = CONCAT(LEFT(`seatNumber`, 1), LPAD(CAST(SUBSTRING(`seatNumber`, 2) AS UNSIGNED), 2, '0'));
UPDATE `SeatHold` SET `seatNumber` = UPPER(TRIM(`seatNumber`));
UPDATE `SeatHold` SET `seatNumber` = SUBSTRING(`seatNumber`, 2)
  WHERE LEFT(`seatNumber`, 1) IN ('1', '2') AND SUBSTRING(`seatNumber`, 2, 1) IN ('A', 'B', 'C');
UPDATE `SeatHold` SET `seatNumber` = CONCAT(LEFT(`seatNumber`, 1), LPAD(CAST(SUBSTRING(`seatNumber`, 2) AS UNSIGNED), 2, '0'));

UPDATE `booking` b JOIN `user` u ON u.id = b.userId JOIN `trip` t ON t.id = b.tripId
SET b.passengerName = u.fullName, b.passengerPhone = u.phone,
    b.pnr = CONCAT('NHAXE-', t.code, '-', b.userId, b.id),
    b.activeSeat = CASE WHEN b.status = 'CANCELLED' THEN NULL ELSE CONCAT(b.tripId, ':', b.seatNumber) END;

-- Sức chứa tối thiểu giữ được mọi ghế đang có vé hiệu lực.
UPDATE `trip` t LEFT JOIN (
  SELECT tripId, COUNT(*) AS sold,
    MAX((CAST(SUBSTRING(seatNumber, 2) AS UNSIGNED) - 1) * 3 + CASE LEFT(seatNumber, 1) WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END) AS highestSeat
  FROM `booking` WHERE status <> 'CANCELLED' GROUP BY tripId
) b ON b.tripId = t.id
SET t.capacity = GREATEST(t.availableSeats + COALESCE(b.sold, 0), COALESCE(b.highestSeat, 0), 1);
UPDATE `trip` t SET t.availableSeats = t.capacity - (SELECT COUNT(*) FROM `booking` b WHERE b.tripId = t.id AND b.status <> 'CANCELLED');
ALTER TABLE `trip` ALTER COLUMN `capacity` DROP DEFAULT;

CREATE UNIQUE INDEX `booking_activeSeat_key` ON `booking`(`activeSeat`);
CREATE INDEX `booking_pnr_idx` ON `booking`(`pnr`);
CREATE INDEX `booking_status_createdAt_idx` ON `booking`(`status`, `createdAt`);
CREATE INDEX `trip_time_idx` ON `trip`(`time`);
CREATE INDEX `SeatHold_expiresAt_idx` ON `SeatHold`(`expiresAt`);

ALTER TABLE `booking` DROP FOREIGN KEY `Booking_tripId_fkey`;
ALTER TABLE `booking` DROP FOREIGN KEY `Booking_userId_fkey`;
ALTER TABLE `booking` ADD CONSTRAINT `Booking_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trip`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `booking` ADD CONSTRAINT `Booking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `SeatHold` ADD CONSTRAINT `SeatHold_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `trip` ADD CONSTRAINT `trip_seat_counts_check` CHECK (`capacity` BETWEEN 1 AND 60 AND `availableSeats` BETWEEN 0 AND `capacity`);
ALTER TABLE `booking` ADD CONSTRAINT `booking_status_check` CHECK (`status` IN ('CONFIRMED', 'PENDING', 'CANCELLED') AND `totalPrice` >= 0);
ALTER TABLE `booking` ADD CONSTRAINT `booking_active_seat_check` CHECK (
  (`status` = 'CANCELLED' AND `activeSeat` IS NULL) OR
  (`status` <> 'CANCELLED' AND `activeSeat` IS NOT NULL AND `activeSeat` = CONCAT(`tripId`, ':', `seatNumber`))
);
