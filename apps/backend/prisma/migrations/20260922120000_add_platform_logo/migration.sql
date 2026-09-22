-- 5.8 店铺 storeLogo 由 platform.logo 派生（对照旧版 mapStoreRow 的 platformLogo→storeLogo）
ALTER TABLE `Platform` ADD COLUMN `logo` TEXT;
