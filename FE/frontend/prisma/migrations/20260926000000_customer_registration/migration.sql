-- Targets the lowercase `user` table from sgu-booking.sql.
-- Existing duplicate phone numbers must be resolved before adding this index.
CREATE UNIQUE INDEX `user_phone_key` ON `user`(`phone`);

CREATE TABLE IF NOT EXISTS `customer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Đang hoạt động',
    `address` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `customer_email_key` ON `customer`(`email`);
CREATE UNIQUE INDEX `customer_phone_key` ON `customer`(`phone`);
