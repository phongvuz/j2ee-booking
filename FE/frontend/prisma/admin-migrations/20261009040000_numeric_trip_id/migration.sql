-- Trip IDs and booking/seat-hold relationships already use integers.
-- Keep existing IDs and PNRs; remove the unused secondary identifier.
ALTER TABLE `trip` DROP INDEX `Trip_code_key`, DROP COLUMN `code`;
