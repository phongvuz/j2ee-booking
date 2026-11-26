-- Validate first: existing fractional or out-of-range amounts must be reviewed,
-- never silently rounded when converting historical prices to integer VND.
ALTER TABLE `trip` ADD CONSTRAINT `trip_integer_vnd_check`
  CHECK (`price` = FLOOR(`price`) AND `price` BETWEEN 0 AND 2147483647);
ALTER TABLE `booking` ADD CONSTRAINT `booking_integer_vnd_check`
  CHECK (`totalPrice` = FLOOR(`totalPrice`) AND `totalPrice` BETWEEN 0 AND 2147483647);

ALTER TABLE `trip` MODIFY COLUMN `price` INTEGER NOT NULL;
ALTER TABLE `booking` MODIFY COLUMN `totalPrice` INTEGER NOT NULL;
