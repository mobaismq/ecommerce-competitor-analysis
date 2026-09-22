-- 5.9 generated_images 保存/productName 筛选所需字段（对照旧版 generated_main_image.product_id/product_name/platform）
ALTER TABLE `GeneratedAsset` ADD COLUMN `productId` TEXT;
ALTER TABLE `GeneratedAsset` ADD COLUMN `productName` TEXT;
ALTER TABLE `GeneratedAsset` ADD COLUMN `platform` TEXT;
