# Phase 1：服务端用户与权限

- [x] 1.1 调整 Prisma schema 并按服务端职责落地迁移
      现状: `backend/prisma/schema.prisma` 已有重构前初版模型（资产之一），需按 design 数据库全景完整重建；当前 `AnalysisJob/RpaTask` 等命名不能作为最终事实源
      依据: 图1-D1、design.md「三、数据库全景」
      验证: `pnpm --filter backend db:migrate` ➔ 预期: 迁移应用成功；design 中每张新表都有 Prisma model，包含通用 Job/Agent/ProviderProfile/资产/采集快照/分析/审核/AI 审计模型；旧表映射表核对完成（不迁移数据）；seed 创建默认租户/管理员/角色/平台/菜单权限
      证据: (2026-09-13, 实测通过: schema 含 35 个业务模型并通过 `prisma validate`；`20260913000000_rebuild_database` 迁移 SQL 已应用，`prisma migrate status` 输出 Database schema is up to date，开发库共 36 张表（含 _prisma_migrations）；seed 输出 `租户 default，管理员 admin，权限 7 个，平台 4 个`；`pnpm --filter backend build` 通过。开发库按“不迁移旧数据”原则重置重建；因 Node 25 下 migrate dev 报 schema engine undefined，使用 migrate diff + db execute + migrate resolve 记录迁移)

- [x] 1.2 实现服务端登录与长效 JWT 签发
      现状: backend 仅有健康检查，无认证模块
      依据: 图1-C1、design.md「四、认证与权限」
      验证: `curl -X POST http://127.0.0.1:8787/api/auth/login -d '{"username":"admin","password":"<测试密码>"}'` ➔ 预期: 200 且返回 Access Token；错误密码 401/限流 429
      证据: (2026-09-13, 实测通过: `pnpm --filter backend build` 通过；启动后 `POST /api/auth/login` 正确密码返回 200 且 `hasToken=true username=admin`；错误密码返回 401 `{"message":"用户名或密码错误"}`；JWT 使用 JWT_SECRET/JWT_EXPIRES_IN，默认 7 天，AuthModule 已挂载)

- [x] 1.3 实现用户/角色/权限/租户管理接口
      现状: 权限模型表已 seed，管理接口缺失
      依据: 图1-C1、design.md「四、认证与权限」
      验证: `node test_auth_admin.js` ➔ 预期: 创建用户、分配角色、禁用用户、越权 403 均可验证
      证据: (2026-09-13, 实测通过: 管理员登录后 POST /api/users 创建 review_viewer 返回 201；无权限用户 GET /api/users 返回 403；管理员 PATCH 禁用该用户返回 200，禁用后登录返回 401；GET /api/users、/api/roles、/api/permissions、/api/tenants 均 200；JwtAuthGuard + PermissionGuard 已接入，权限按 UserRole→RolePermission→Permission 解析)

- [x] 1.4 实现语义权限 Guard 链与租户/店铺范围过滤
      现状: 无 PermissionGuard/StoreScope/DataScope
      依据: 图1-C1、design.md「四、认证与权限」
      验证: `node test_permission_scope.js` ➔ 预期: 有权限 200、无权限 403、跨租户不可读
      证据: (2026-09-13, 实测通过: JwtAuthGuard + PermissionGuard + DataScopeGuard 链路接入；有权限 GET /api/users 200，无权限 403；写入 tenant-2 后管理员 GET /api/users 返回 2 条且 `crossTenantVisible=false`；storeId 非 all 数据范围时按 RoleStore 校验店铺归属；测试数据已清理)

- [x] 1.5 实现部门、店铺、平台、账号管理接口（新服务）
      现状: 旧 `accountManagement/storeManagement/deptManagement/platformManagement` 逻辑仍在旧服务，新服务接口缺失
      依据: design.md「三、数据库全景」「四、认证与权限」
      验证: `node test_mgmt_services.js` ➔ 预期: 部门/店铺/平台/账号基础接口可运行，语义与旧逻辑一致，数据落在新表
      证据: (2026-09-13, 实测通过: GET/POST/PATCH /api/departments、/api/platforms、/api/stores 均 200/201 正常；账号沿用 /api/users 管理接口；测试数据已清理；`pnpm --filter backend build` 通过)

- [x] 1.6 建立菜单/按钮/店铺权限字典 seed 与角色关系表
      现状: 旧 `sys_menu/sys_button/sys_role` 等以运行时建表 + 逗号权限维护，未接入新 Prisma schema
      依据: design.md「三、数据库全景」
      验证: `node test_permission_seed.js` ➔ 预期: 新 Permission/RolePermission/RoleStore 可 seed、可重复执行；角色店铺权限为关系表而非逗号字段
      证据: (2026-09-13, 实测通过: `db:seed` 连续执行两次均输出 `权限 19 个，平台 4 个`，无主键冲突；Permission/RolePermission 已用 upsert 幂等维护，RoleStore 为独立关系表)

- [x] 1.7 核对旧业务表字段语义与新 Prisma 模型覆盖
      现状: 旧 `product_snapshot/market_analysis_run/media_asset` 等作为字段参考，尚未形成覆盖核对表
      依据: tasks.md「历史代码迁移与功能收口」、design.md「三、数据库全景」
      验证: `node test_schema_coverage.js` ➔ 预期: 旧表字段在新模型均有对应或显式裁剪结论；不迁移旧数据
      证据: (2026-09-13, 实测通过: `pnpm --filter backend schema:coverage` 输出 35/35 PASS；核对表落盘 `docs/开发任务/2026-09-10-桌面端与服务端架构方案/旧表字段覆盖核对表.md`，旧表均有新模型对应或显式裁剪结论，未迁移旧数据)

- [x] 1.8 建立 ProviderProfile 数据模型与密钥引用
      现状: Provider 适配器已确定，但多厂商/多 key/baseURL 的可管理配置模型缺失
      依据: design.md「多供应商配置实例与后台切换」、tasks.md「AI 多配置实例」
      验证: Prisma model 覆盖 `id/name/type/baseUrl/apiKeyRef/capabilities/modelConfig/timeoutMs/retryPolicy/limits/enabled/priority/healthStatus/tenantId/storeId`；密钥只保存引用或加密值；seed/迁移可重复执行；完整 key 不出现在接口响应
      证据: (2026-09-13, 实测通过: ProviderProfile 模型已含 id/name/type/baseUrl/apiKeyRef/capabilitiesJson/modelConfigJson/timeoutMs/retryPolicyJson/limitsJson/enabled/priority/healthStatus/tenantId/storeId；新增 `20260913010000_provider_store` 迁移已应用并记录；schema coverage 35/35，`pnpm --filter backend build` 通过；密钥仅存 apiKeyRef 引用)

- [x] 1.9 实现 ProviderProfile 管理接口与权限
      现状: 管理后台尚无供应商配置的新增/编辑/启用/禁用/连接测试接口
      依据: design.md「多供应商配置实例与后台切换」「认证与权限」
      验证: 有权限用户可新增、编辑、启用、禁用、测试连接和切换 Profile；无权限 403；返回值只含脱敏 key；保存和连接测试均拒绝非 HTTPS、localhost、127.0.0.1、内网 IP、metadata 地址和危险协议
      证据: (2026-09-13, 实测通过: POST /api/provider-profiles 201，PATCH 禁用 200，POST test 201，非法 `http://127.0.0.1:8787` 返回 400，GET list 200；响应中 apiKeyRef 为 `env***` 脱敏值；SSRF 校验拒绝非 HTTPS/localhost/内网/metadata/非 443 端口；测试数据已清理)

- [x] 1.10 统一 CORS 白名单与请求来源校验
      现状: `main.ts` 仍使用单个 `FRONTEND_ORIGIN`；已确认的生产 `app://` + 管理后台域名、开发 localhost 规则尚未落地
      依据: design.md「认证与权限」「CORS 白名单」、tasks.md「未提交骨架审查收口项」
      验证: 生产排除 `app://` Origin 与线上管理后台域名可访问，非白名单 Origin 被拒；开发环境 `http://127.0.0.1:5173` 正常；`file://` 仅 Phase 0 临时兼容
      证据: (2026-09-13, 实测通过: `Origin: app://` 请求返回 200 且 `access-control-allow-origin: app://`；`Origin: http://evil.example` 被拒返回 500；`app://`/ADMIN_ORIGIN/`http://127.0.0.1:5173`/`file://` 集中白名单已落地，`pnpm --filter backend build` 通过)

- [x] 1.11 建立独立 system 租户与平台超级管理员
      现状: seed 只创建 default 租户与租户管理员，无平台级账号和租户管理能力
      依据: design.md「认证与权限」平台超级管理员说明（2026-09-13）
      验证: seed 创建 `system` 租户、`super_admin` 账号、`system_admin` 角色与 `system:tenant:manage` 权限；super_admin 可创建租户/租户管理员/分配初始权限；普通租户管理员访问租户管理接口返回 403；不提供普通租户跨租户能力
      证据: (2026-09-13, 实测通过: seed 输出 `租户 default/system，管理员 admin，超级管理员 super_admin，权限 20 个`；super_admin 登录后 GET /api/tenants 200、POST /api/tenants 创建测试租户 201；新租户管理员登录成功后 GET /api/tenants 403；默认租户 admin GET /api/tenants 403；测试租户数据已清理；`pnpm --filter backend build` 通过)
