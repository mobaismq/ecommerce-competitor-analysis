-- 5.3 店铺授权时间 auth_time 字段（对照旧版 storeManagement.js auth_time 列）
ALTER TABLE `Store` ADD COLUMN `authorizedAt` DATETIME(3);
