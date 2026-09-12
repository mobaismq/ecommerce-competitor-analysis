# Phase 5：资产与 StorageDriver

- [ ] 5.1 实现 StorageDriver 抽象与本地目录驱动
      现状: 本地无 OSS 驱动；原 LocalStorageService 思路保留为抽象，厂商/region/bucket 待补充
      依据: 图1-D3、design.md「八、图片与文件资产」
      验证: `node test_storage_driver.js`（本地目录） ➔ 预期: 驱动按环境选择（开发=本地目录，线上=OSS 待接入）；`signUploadUrl/confirmUpload/head/delete/getReadUrl/putObject` 统一接口工作；业务代码不依赖具体厂商
      证据:

- [ ] 5.2 实现预签名上传与上传确认接口（通过 StorageDriver，厂商待补）
      现状: 桌面端直传存储的凭证签发与确认链路缺失；OSS 厂商/region/dev-prod bucket 待补充
      依据: design.md「八、图片与文件资产」
      验证: Agent 请求上传凭证后可在有效期内 PUT 文件到本地目录（开发环境）；confirm 后服务端校验对象并返回 assetId；过期或越权 Key 被拒绝；线上接入 OSS 只改配置与 StorageDriver 实现
      证据:

- [ ] 5.3 实现 generated_assets 记录与鉴权读取接口
      现状: 资产表在 schema 中，且缺少 runId/sourceUrl 等字段，接口缺失
      依据: 图1-D3、架构图「图片落 OSS」判据
      验证: `curl -i http://127.0.0.1:8787/api/assets/<assetId>` ➔ 预期: 资产记录含 storageKey/mimeType/size/runId/sourceUrl；有权限返回正确 MIME，无权限 403，不存在 404
      证据:

- [ ] 5.4 实现孤儿对象与失败/重试文件清理
      现状: 无清理规则
      依据: design.md「八、图片与文件资产」
      验证: `node test_storage_cleanup.js` ➔ 预期: 无引用对象清理、有引用对象保留
      证据:

- [ ] 5.6 校验 StorageDriver 环境路由与本地/线上边界
      现状: 开发本地目录、线上 OSS 的环境区分已确定，跨环境验收缺失
      依据: design.md「图片与文件资产」
      验证: 开发环境不访问 OSS 且文件落项目本地目录；线上环境不写开发目录且使用 OSS；业务接口和资产记录格式一致；StorageDriver 切换不改变业务 Pipeline
      证据:

- [ ] 5.5 迁移旧本地资产生成物（public/generated 等）
      现状: 旧 `app/public/generated/product-sets` 等本地文件未纳入新资产体系
      依据: design.md「八、图片与文件资产」
      验证: `node test_storage_legacy_migration.js` ➔ 预期: 旧本地资产可标记迁移/引用或清理，迁移过程幂等可校验
      证据:
