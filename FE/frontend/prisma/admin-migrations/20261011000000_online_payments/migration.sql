CREATE TABLE `Payment` (
    `id` VARCHAR(32) NOT NULL,
    `pnr` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `checkoutUrl` TEXT NOT NULL,
    `providerTransactionId` VARCHAR(100) NULL,
    `responseCode` VARCHAR(10) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `Payment_providerTransactionId_key` (`providerTransactionId`),
    INDEX `Payment_pnr_createdAt_idx` (`pnr`, `createdAt`),
    INDEX `Payment_status_createdAt_idx` (`status`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
