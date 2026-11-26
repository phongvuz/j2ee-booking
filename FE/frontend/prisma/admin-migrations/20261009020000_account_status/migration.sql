ALTER TABLE `user` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;
UPDATE `user` u JOIN `customer` c ON c.phone = u.phone
SET u.isActive = (c.status = 'Đang hoạt động') WHERE u.role = 'CUSTOMER';
