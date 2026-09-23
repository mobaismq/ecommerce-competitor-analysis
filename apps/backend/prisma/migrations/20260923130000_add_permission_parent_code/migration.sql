-- 权限层能力层(2.2)：Permission 增加显式父子关系 parentCode（替代 `:` 切割启发式），供角色权限树/按钮归属使用
ALTER TABLE `Permission`
  ADD COLUMN `parentCode` VARCHAR(191) NULL;
