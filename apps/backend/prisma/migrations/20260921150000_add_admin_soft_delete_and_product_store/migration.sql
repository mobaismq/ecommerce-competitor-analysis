-- Admin soft-delete fields + product store dimension
ALTER TABLE `Department` ADD COLUMN `deletedAt` DATETIME(3) NULL;

ALTER TABLE `Product` ADD COLUMN `storeId` VARCHAR(191) NULL;

ALTER TABLE `Role` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'active';

ALTER TABLE `Store` ADD COLUMN `authorizedBy` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `Department_tenantId_deletedAt_idx` ON `Department`(`tenantId`, `deletedAt`);

CREATE INDEX `Product_tenantId_storeId_idx` ON `Product`(`tenantId`, `storeId`);

CREATE INDEX `Role_tenantId_status_idx` ON `Role`(`tenantId`, `status`);

CREATE INDEX `Store_tenantId_deletedAt_idx` ON `Store`(`tenantId`, `deletedAt`);
