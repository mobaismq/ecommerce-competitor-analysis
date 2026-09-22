-- Platform soft-delete (5.1 平台删除，is_deleted → deletedAt)
ALTER TABLE `Platform` ADD COLUMN `deletedAt` DATETIME(3) NULL;
