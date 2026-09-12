# Phase 5：图片资产

- [ ] 5.1 实现 LocalStorageService 和安全文件校验
      现状: 旧图片逻辑写入 `app/public/generated/product-sets`，新 `backend/uploads` 存储服务缺失
      依据: 图1-B6、图1-C2、图3-图片资产
      验证: `node test_local_storage.js` ➔ 预期: 合法文件写入安全生成的 key，非法 MIME、扩展名、大小和路径输入被拒绝
      证据: 

- [ ] 5.2 实现 generated_assets 数据记录和鉴权读取接口
      现状: 新图片资产模型和 `/api/assets/:assetId` 接口缺失
      依据: 图1-B6、架构图「图片落盘」判据
      验证: `curl -i http://127.0.0.1:8787/api/assets/<assetId>` ➔ 预期: 有权限返回正确 MIME 文件，无权限返回 403，不存在返回 404
      证据: 

- [ ] 5.3 实现失败任务、重试和删除后的孤儿文件清理
      现状: 本地/线上文件清理规则尚未实现
      依据: design.md「本地图片存储」补充约定
      验证: `node test_storage_cleanup.js` ➔ 预期: 无业务记录引用的文件被清理，仍被引用的文件保留
      证据: 
