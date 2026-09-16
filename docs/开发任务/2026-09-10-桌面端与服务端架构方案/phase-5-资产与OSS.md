# Phase 5：资产与 StorageDriver

- [x] 5.1 实现 StorageDriver 抽象与本地目录驱动
      现状: 本地无 OSS 驱动；原 LocalStorageService 思路保留为抽象，厂商/region/bucket 待补充
      依据: 图1-D3、design.md「八、图片与文件资产」
      验证: `node test_storage_driver.js`（本地目录） ➔ 预期: 驱动按环境选择（开发=本地目录，线上=OSS 待接入）；`signUploadUrl/confirmUpload/head/delete/getReadUrl/putObject` 统一接口工作；业务代码不依赖具体厂商
      证据: (2026-09-15, 实测通过: `pnpm --filter backend storage-driver-smoke` 返回 `{"driverName":"local","put":{"size":9,"mime":"image/png","sha256":true,"fileExists":true},"head":{"size":9,"mime":"image/png","missing":true},"readUrl":true,"signUpload":{"uploadId":true,"method":"PUT","keyPrefix":true},"confirm":{"size":8,"mime":"image/jpeg"},"delete":{"deleted":true,"afterDelete":true},"traversalRejected":true,"ossNotReady":true}`；新增 `storage.types.ts` 统一 `StorageDriver` 接口（putObject/head/delete/getReadUrl/signUploadUrl/confirmUpload），`LocalStorageDriver` 落 `STORAGE_LOCAL_DIR` 并按 `{prefix}/{tenantId}/{bizType}/{runId}` 组织对象 key，含 sha256/路径越界防护；`OssStorageDriver` 占位待接入；`StorageDriverService` 按 `STORAGE_DRIVER=local|oss` 环境选择，业务代码不感知厂商；`pnpm --filter backend build` 通过)

- [x] 5.2 实现预签名上传与上传确认接口（通过 StorageDriver，厂商待补）
      现状: 桌面端直传存储的凭证签发与确认链路缺失；OSS 厂商/region/dev-prod bucket 待补充
      依据: design.md「八、图片与文件资产」
      验证: Agent 请求上传凭证后可在有效期内 PUT 文件到本地目录（开发环境）；confirm 后服务端校验对象并返回 assetId；过期或越权 Key 被拒绝；线上接入 OSS 只改配置与 StorageDriver 实现
      证据: (2026-09-15, 实测通过: `pnpm --filter backend storage-upload-smoke` 返回 `{"http":{"signStatus":201,"putStatus":200,"confirmStatus":201,"forgedStatus":401,"expiredStatus":401},"asset":{"assetId":true,"storageKey":"dev/default/generated/run-123/...-main.png","fileExists":true,"size":8}}`；`POST /api/storage/uploads` 签发带 HMAC 签名的上传票据，`PUT /api/storage/dev-upload` 二进制直传本地目录，`POST /api/storage/uploads/:uploadId/confirm` 校验票据+size 后返回 assetId 并落 GeneratedAsset/MediaAsset；伪造签名与过期票据均 401 拒绝；线上接入 OSS 只改 StorageDriver 实现与配置；`pnpm --filter backend build` 通过)

- [x] 5.3 实现 generated_assets 记录与鉴权读取接口
      现状: 资产表在 schema 中，且缺少 runId/sourceUrl 等字段，接口缺失
      依据: 图1-D3、架构图「图片落 OSS」判据
      验证: `curl -i http://127.0.0.1:8787/api/assets/<assetId>` ➔ 预期: 资产记录含 storageKey/mimeType/size/runId/sourceUrl；有权限返回正确 MIME，无权限 403，不存在 404
      证据: (2026-09-15, 实测通过: `pnpm --filter backend assets-read-smoke` 返回 `{"http":{"adminFindStatus":200,"adminRawStatus":200,"noPermFindStatus":403,"noPermRawStatus":403,"missingStatus":404},"raw":{"mime":"image/png","text":"png-bytes"},"fields":{"storageKey":"test/assets/main.png","mimeType":"image/png","size":9,"runId":"run-1","sourceUrl":"https://example.com/1.png"}}`；`GET /api/assets/:id` 返回 storageKey/mimeType/size/runId/sourceUrl/originalName/readUrl；`GET /api/assets/:id/raw` 按正确 MIME 返回文件内容；`asset:view` 权限校验（无权限 403、不存在 404）；`pnpm --filter backend build` 通过)

- [x] 5.4 实现孤儿对象与失败/重试文件清理
      现状: 无清理规则
      依据: design.md「八、图片与文件资产」
      验证: `node test_storage_cleanup.js` ➔ 预期: 无引用对象清理、有引用对象保留
      证据: (2026-09-15, 实测通过: `pnpm --filter backend storage-cleanup-smoke` 返回 `{"cleanup":{"scanned":3,"referencedCount":2,"orphanCount":2,"deleted":2,"errors":[]},"orphan1Gone":true,"failedUploadGone":true,"referencedKept":true}`；StorageDriver 新增 `listObjects()`，`StorageCleanupService.cleanupOrphans()` 对比 GeneratedAsset/MediaAsset 引用，孤儿文件（含失败/未确认上传）删除、有引用对象保留，单个删除失败记录不阻塞；`pnpm --filter backend build` 通过)

- [x] 5.6 校验 StorageDriver 环境路由与本地/线上边界
      现状: 开发本地目录、线上 OSS 的环境区分已确定，跨环境验收缺失
      依据: design.md「图片与文件资产」
      验证: 开发环境不访问 OSS 且文件落项目本地目录；线上环境不写开发目录且使用 OSS；业务接口和资产记录格式一致；StorageDriver 切换不改变业务 Pipeline
      证据: (2026-09-15, 实测通过: `pnpm --filter backend storage-env-routing-smoke` 返回 `{"local":{"isLocal":true,"fileExists":true,"cleanupScanned":1},"asset":{"runId":"env-run","storageKey":"env/assets/local.png","mimeType":"image/png","sourceUrl":"https://example.com/local.png"},"oss":{"isOss":true,"putRejected":true,"assetRejected":true,"dirWritten":false}}`；`STORAGE_DRIVER=local` 时业务入口（driver/AssetService/Cleanup）全部落本地目录且不触碰 OSS；`STORAGE_DRIVER=oss` 时走 OssStorageDriver 占位（写入/资产读取均抛“待接入”），OSS 目录不被写入；资产元数据格式（runId/storageKey/mimeType/sourceUrl）不随驱动变化；`pnpm --filter backend build` 通过)

- [x] 5.5 迁移旧本地资产生成物（public/generated 等）
      现状: 旧 `apps/legacy/public/generated/product-sets` 等本地文件未纳入新资产体系
      依据: design.md「八、图片与文件资产」
      验证: `node test_storage_legacy_migration.js` ➔ 预期: 旧本地资产可标记迁移/引用或清理，迁移过程幂等可校验
      证据: (2026-09-15, 实测通过: `pnpm --filter backend storage-legacy-migration-smoke` 返回 `{"first":{"scanned":2,"migrated":2,"skipped":0,"errors":0},"assets":{"count":2,"keys":["legacy/3efb469ca2c73f33/old1.png","legacy/ab360113aeab2e69/old2.jpg"]},"originalsKept":true,"storedFilesExist":true,"second":{"migrated":0,"skipped":2},"assetCountAfter":2}`；`LegacyAssetMigrationService` 扫描 `LEGACY_ASSET_DIRS`（默认 `apps/legacy/public/generated/product-sets`）图片文件，按 sha256 内容寻址复制到新存储并登记 GeneratedAsset（runId=legacy-migration、sha256、sourceUrl 保留原路径），原文件保留；重复迁移幂等（同内容跳过）；`pnpm --filter backend build` 通过)

- [x] 5.7 落地本地存储默认与可选同步开关
      现状: 存储抽象已有，但本地存储默认与 OSS 同步开关未落地
      依据: design.md「桌面端本地优先与服务端管理边界（2026-09-14）」
      验证: 默认资产写入本地目录；开启 `sync.asset` 后才调用 OSS/服务端上传；开关可切换、幂等、不影响本地记录与读取
      证据: (2026-09-15, 实测通过: `pnpm --filter backend asset-sync-switch-smoke` 返回 `{"localOnly":{"reused":false,"syncEnabled":false,"remoteStatus":"skipped","localFiles":true},"idempotent":{"reused":true,"sameAssetId":true,"totalAssets":3},"syncOn":{"enabled":true,"remoteStatus":"not-ready","errorCaptured":true},"syncOff":{"enabled":false,"remoteStatus":"skipped"}}`；`AssetWriteService` 默认只写本地（内容寻址 storageKey 幂等，同内容不重复登记）；`SYNC_ASSET=true` 才额外尝试 OSS 同步，OSS 未接入时 remoteStatus=not-ready 且不阻塞本地写入；开关切回 false 恢复 local-only；`pnpm --filter backend build` 通过)
