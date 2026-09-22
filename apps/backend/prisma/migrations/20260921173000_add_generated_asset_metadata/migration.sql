-- 主图/图库回显所需的最小生成元数据
ALTER TABLE `GeneratedAsset` ADD COLUMN `category` TEXT;
ALTER TABLE `GeneratedAsset` ADD COLUMN `prompt` TEXT;
ALTER TABLE `GeneratedAsset` ADD COLUMN `ratio` TEXT;
