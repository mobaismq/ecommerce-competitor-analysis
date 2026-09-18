-- PostRefactor: persist 429 backoff deadline across restarts
ALTER TABLE `Job` ADD COLUMN `nextRetryAt` DATETIME(3) NULL;
