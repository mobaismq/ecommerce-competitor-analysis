-- 1.13 图库真源：GeneratedAsset 补操作人；5.12 dept 补层级与启用状态（对照旧版 dept_level / dept_status）
ALTER TABLE `GeneratedAsset`
  ADD COLUMN `createdBy` VARCHAR(191) NULL;

ALTER TABLE `Department`
  ADD COLUMN `level` INT NOT NULL DEFAULT 1,
  ADD COLUMN `enabled` BOOLEAN NOT NULL DEFAULT true;
