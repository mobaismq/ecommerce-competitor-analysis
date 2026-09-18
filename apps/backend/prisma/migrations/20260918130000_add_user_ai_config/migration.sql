-- Per-user AI provider self-config + job owner tracking
ALTER TABLE `User` ADD COLUMN `aiSelfEnabled` BOOLEAN NULL, ADD COLUMN `aiProviderType` VARCHAR(191) NULL, ADD COLUMN `aiBaseUrl` VARCHAR(191) NULL, ADD COLUMN `aiApiKey` VARCHAR(191) NULL, ADD COLUMN `aiModel` VARCHAR(191) NULL, ADD COLUMN `aiTimeoutMs` INT NULL;
ALTER TABLE `Job` ADD COLUMN `userId` VARCHAR(191) NULL;
