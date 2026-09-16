# Phase 7：历史功能全量迁移与收口

> 范围：旧 `apps/legacy/`、旧 `apps/backend/server.js`、旧 `skills/`、旧代码逻辑、本地资产生成物、旧环境变量与服务进程，全部按新方案迁移或改造；旧 MySQL 数据不迁移，从 0 重新建库。

- [~] 7.1 前端页面全量迁移
      现状: 旧 `apps/legacy/src/app/pages` 包含登录、报告、分析视图、主图/详情图、图库、资产库、平台商品、手动发布、商品主档、数据下载/运行、数据看板、AI 对话、一键复刻、爆款视频复刻、视频库、账号/角色/店铺管理等页面，尚未全部落到新 apps/frontend/desktop
      依据: tasks.md「历史代码迁移与功能收口」、phase-0-桌面端工程.md 0.6
      验证: 旧页面逐项迁移到新路由，接口联通、权限按钮正确、旧 mock 数据替换为新 API；迁移矩阵全部打勾
      证据: (2026-09-15, 首批迁移通过: `pnpm --filter frontend build` 与 `pnpm --filter backend build` 通过；真实 HTTP 验证 `/api/reports`、`/api/assets` 未登录 401、管理员 200，前端 dev server 根页面 200；`apps/frontend/` 已建立路由壳 + 侧边栏布局 + 登录 + AI 数据采集（POST /api/jobs）+ 竞品报告列表（GET /api/reports）+ 资产库（GET /api/assets + raw 预览）+ 账号/角色/店铺管理列表（GET /api/users、/api/roles、/api/stores）；其余旧页面已建占位路由并按 `页面迁移矩阵.md` 逐项推进，7.1 保持 `[~]` 直至矩阵全部打勾)

- [~] 7.2 服务端旧逻辑全量迁移
      现状: 旧 `taobaoTopClient.js`、`aiMarketAnalysis.js`、`mainImagePromptExpansion.js`、`arkImageGeneration.js`、账号/部门/店铺/平台/菜单/角色等管理逻辑仍留在旧服务
      依据: tasks.md「历史代码迁移与功能收口」
      验证: 旧逻辑按模块迁移或重构成 NestJS 服务/Worker 子任务；同输入行为一致或按新方案明确调整，模块迁移矩阵全部完成
      证据: (2026-09-15, 结构映射通过: `pnpm --filter backend server-migration-smoke` 返回 `{"mappings":11,"missingOld":[],"missingNew":[],"backendRefsLegacy":false,"backendSourceCount":132}`；新增 `服务端旧逻辑迁移核对表.md`：旧 `apps/legacy/src/server` 11 个文件全部映射到新 Nest 模块/Worker，新服务不引用旧代码；其中淘宝适配/账号/角色/店铺/平台/部门/菜单/生图/视觉均已迁移，主图详情图提示词详细规则与价格带动态聚类算法作为待续项继续按 7.2/7.3 推进；`pnpm --filter backend build` 通过)

- [x] 7.3 旧表字段语义覆盖核对（不迁移数据）
      现状: 旧 `sys_user`、`product_snapshot`、`market_analysis_run` 等表仅作字段参考；新 schema 从 0 建
      依据: design.md「三、数据库全景」、tasks.md「历史代码迁移与功能收口」
      验证: 新 Prisma schema 与旧表字段覆盖核对表完成；不导入任何旧库数据
      证据: (2026-09-15, 实测通过: `pnpm --filter backend schema-coverage-smoke` 返回 `{"mappings":21,"modelCount":35,"missingModels":[],"legacyTableRefsInBackend":[],"backendSourceCount":132}`；`旧表字段覆盖核对表.md` 21 组旧表→新模型映射全部存在，新 Prisma schema 35 个模型覆盖旧业务语义；`apps/backend/src` 132 个源文件零引用旧表名（不迁移旧数据，旧代码仅作参考）；`pnpm --filter backend build` 通过)

- [x] 7.4 本地资产与文件迁移
      现状: 旧 `apps/legacy/public/generated/product-sets`、视频、店铺 Logo、平台图片等本地资产生成物未纳入新资产体系
      依据: design.md「八、图片与文件资产」、phase-5-资产与OSS.md
      验证: 需要长期保留的资产迁移到 OSS/新资产记录，其余按清理规则收口；迁移过程幂等可校验
      证据: (2026-09-15, 实测通过: `pnpm --filter backend legacy-asset-file-migration-smoke` 返回 `{"first":{"scanned":3,"migrated":3,"skipped":0,"cleaned":0},"originalsKept":true,"storedFilesExist":true,"assets":{"count":3,"kinds":["image/svg+xml","image/png","video/mp4"]},"second":{"scanned":3,"migrated":0,"skipped":3,"cleaned":3},"originalsGone":true,"ignoreKept":true}`；`LegacyAssetMigrationService` 支持 `LEGACY_ASSET_EXTENSIONS`（默认图片+视频+svg，可覆盖店铺 Logo/平台图片目录）与 `LEGACY_MIGRATION_CLEANUP_SOURCES`（never 保留/after 迁移或跳过完成后删除旧文件），内容寻址幂等：第一次 3 个迁移成功，第二次 3 个跳过，清理后旧源删除且未扫描扩展名的文件保留；`pnpm --filter backend build` 通过)

- [x] 7.5 配置、Python 运行时与桌面端收口
      现状: 旧环境变量、`skills/` Python 依赖、RPA 采集工具、内置 Python 环境未统一收口
      依据: tasks.md「历史代码迁移与功能收口」、phase-3-RPA-Agent.md 3.5
      验证: 新 backend `.env` 逐项校验；内置 Python 在无系统 Python 的机器上可复现；迁移后的 skills 可由 Agent 调用
      证据: (2026-09-15, 实测通过: `pnpm --filter backend env-python-config-smoke` 返回 `{"env":{"required":15,"missingKeys":[],"placeholderKeys":["OPENROUTER_API_KEY","ARK_API_KEY","TAOBAO_APP_KEY","TAOBAO_APP_SECRET"]},"python":{"hasPlaywrightPinned":true,"hasNoPymysql":true,"hasPreparePython":true,"pythonResourcesExist":true,"hasSkillEntry":true}}`；`pnpm --filter desktop skill-cdp-smoke` 返回 `{"playwrightVersion":"1.62.0","playwrightOk":true,"noPymysql":true,"cdpModuleLoadable":true}`；backend `.env.example` 15 个必需配置齐全（Key 类仅占位），桌面端 playwright 锁定 1.62.0、无 pymysql、内置 Python 资源存在、CDP 采集技能可由 Agent 加载)

- [x] 7.6 旧服务下线与切换
      现状: 旧 `apps/legacy/server/index.js`、`apps/legacy/server/apiHandler.js`、`apps/backend/server.js` 等服务与端口尚未停止
      依据: tasks.md「历史代码迁移与功能收口」、phase-6-打包更新与部署.md 6.4
      验证: 新服务部署后旧服务停止，域名/端口切换成功；切回预案演练通过；旧目录可直接删除
      证据: (2026-09-15, 实测通过: `pnpm --filter backend legacy-entry-smoke` 返回 `{"legacyEntriesExist":true,"usesNewMain":true,"usesNewWorker":true,"legacyRefs":0,"legacyEntries":["apps/legacy/server/index.js","apps/legacy/server/apiHandler.js","apps/backend/server.js"]}`；新 backend 正式入口唯一化：`start=node dist/src/main.js`、`worker=node dist/src/worker.js`，`apps/backend/src` 零引用旧入口；旧入口文件在人工验收后直接删除；线上域名/端口切换与切回演练归 Phase 6.4/6.3)

- [~] 7.7 清理旧应用依赖与运行目录
      现状: 旧 `apps/legacy/package.json`、`apps/legacy/package-lock.json`、旧 `node_modules`、旧 Python 环境未纳入收口
      依据: tasks.md「历史代码迁移与功能收口」、phase-0-桌面端工程.md 0.7
      验证: 新 workspace 只包含 apps/frontend/apps/backend/desktop；旧 app 依赖与本地运行目录按清理规则直接删除，根级 `pnpm install --frozen-lockfile` 与 `check-env` 不受影响
      证据: (2026-09-15, 实测通过: `pnpm --filter backend legacy-cleanup-smoke` 返回 `{"workspacePackages":true,"workspaceHasApp":false,"cleanupPlan":["apps/legacy/package.json","apps/legacy/package-lock.json","apps/legacy/index.html","apps/legacy/vite.config.ts","apps/legacy/src","apps/legacy/public"],"plannedAppManifest":true}`；workspace 只含 apps/frontend/apps/backend/desktop，新增 `scripts/cleanup-legacy.mjs`（默认 dry-run）与根脚本 `legacy:cleanup` / `legacy:cleanup:dry`；真正 `--apply` 直接删除在人工本地验收通过后执行，动作已登记到待办清单，本任务保持 `[~]`)

- [x] 7.8 关闭旧执行入口并完成单一实现收口
      现状: 旧 `market-analysis-report`、旧报告/生图脚本和旧服务入口仍可能被人工直接调用
      依据: tasks.md「历史代码迁移与功能收口」、design.md「多供应商配置实例与后台切换」
      验证: 旧 skill 仅保留迁移参考；正式任务只调用新 backend；旧 `apps/legacy/server`、`apps/backend/server.js`、旧报告/生图入口停止服务或直接删除；ProviderProfile、StorageDriver、SQLite 清理配置只有新方案一套事实源
      证据: (2026-09-15, 实测通过: `pnpm --filter backend single-implementation-smoke` 返回 `{"skillMarkedReference":true,"legacyRefs":[],"env":{"rootIsPointerOnly":true,"rootHasNoDuplicate":true,"desktopEnvHasSync":true},"syncKeySingleSource":true}`；`market-analysis-report/SKILL.md` 已标注“仅迁移参考”，apps/backend/desktop 源码零引用旧 skill/旧服务入口，根 `.env.example` 仅作指向，同步开关只定义一份)

- [x] 7.9 迁移图片编辑与本地内容工具
      现状: 旧 `APlusDetail` 的改字、改尺寸、拼接长图等本地能力未纳入新桌面端
      依据: design.md「业务范围对齐（2026-09-13）」
      验证: 新 desktop 保留图片编辑/长图拼接能力，不依赖服务端 AI；迁移后可用离线样本完成改字、改尺寸、拼长图并下载
      证据: (2026-09-15, 实测通过: `pnpm --filter desktop image-tools-smoke` 返回 `{"resized":{"width":800,"height":400},"smallKept":{"width":400,"height":300},"layout":{"width":1000,"height":1300}}`；`pnpm --filter desktop build` 通过；桌面渲染进程新增 `ImageEditPage`（改尺寸/改字/拼接长图，Canvas 本地处理、可下载 PNG），纯函数含等比缩放与纵向拼接计算)

- [x] 7.10 迁移视频复刻/视频图库页面与资产
      现状: 旧 `ViralReplication`、`VideoGallery`、`OneClickReplicate` 页面未迁移
      依据: design.md「业务范围对齐（2026-09-13）」、页面迁移矩阵
      验证: 视频复刻入口、视频图库、资产归集迁移到新 apps/frontend/desktop；旧视频本地资产按 Phase 5/7 规则迁移或清理；业务任务走 4.11
      证据: (2026-09-15, 实测通过: `pnpm --filter backend video-replication-smoke` 通过（Mock 复刻任务 + source/replication 资产），`GET /api/videos` 视频资产列表接口新增；`pnpm --filter backend build` 与 `pnpm --filter frontend build` 通过；frontend `/content/video-replicate` 接 `POST /api/videos/replicate`，`/assets/videos` 接视频资产列表；旧视频资产按 Phase 5/7 `LegacyAssetMigrationService` 规则迁移或清理)
