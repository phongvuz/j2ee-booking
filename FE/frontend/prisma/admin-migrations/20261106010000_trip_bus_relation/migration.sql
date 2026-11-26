-- Back up the database and stop writers before applying this migration.
-- Existing trips have no verified physical bus assignment. Preserve each trip's
-- original capacity in a clearly marked, inactive placeholder, never a guessed bus.
ALTER TABLE `bus` RENAME COLUMN `seats` TO `capacity`;
ALTER TABLE `bus` ADD CONSTRAINT `bus_capacity_check` CHECK (`capacity` BETWEEN 1 AND 60);

ALTER TABLE `trip` ADD COLUMN `busId` VARCHAR(191) NULL;
INSERT INTO `bus` (`id`, `plate`, `type`, `capacity`, `status`, `notes`, `createdAt`)
SELECT CONCAT('LEGACY-TRIP-', `id`), CONCAT('LEGACY-TRIP-', `id`),
       'Xe chưa xác minh', `capacity`, 'Ngừng hoạt động',
       CONCAT('Bản ghi chuyển đổi cho chuyến ', `id`, '. Chưa xác minh xe thực tế; không phải biển số xe. Giữ nguyên sức chứa cũ: ', `capacity`, '.'),
       CURRENT_TIMESTAMP(3)
FROM `trip`;
UPDATE `trip` SET `busId` = CONCAT('LEGACY-TRIP-', `id`);

-- Imported snapshots can lack the historical CHECK. Never edit its migration.
SET @drop_trip_capacity_check = (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE `trip` DROP CHECK `trip_seat_counts_check`',
    'SELECT 1')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'trip'
    AND CONSTRAINT_NAME = 'trip_seat_counts_check' AND CONSTRAINT_TYPE = 'CHECK'
);
PREPARE trip_capacity_check_statement FROM @drop_trip_capacity_check;
EXECUTE trip_capacity_check_statement;
DEALLOCATE PREPARE trip_capacity_check_statement;

ALTER TABLE `trip`
  MODIFY `busId` VARCHAR(191) NOT NULL,
  ADD INDEX `trip_busId_idx` (`busId`),
  ADD CONSTRAINT `trip_busId_fkey` FOREIGN KEY (`busId`) REFERENCES `bus` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  DROP COLUMN `capacity`,
  ADD CONSTRAINT `trip_seat_counts_check` CHECK (`availableSeats` BETWEEN 0 AND 60);
-- Cross-table availableSeats <= bus.capacity is checked by application transactions.
