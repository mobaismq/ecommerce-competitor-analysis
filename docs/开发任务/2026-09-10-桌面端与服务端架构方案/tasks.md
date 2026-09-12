# 桌面端 + 服务端架构 任务清单

> 依据：`架构图/架构图.md`、`design.md`、`.agents/workflows/plan.md`
> 范围：桌面端（Electron + RPA Agent）与服务端（NestJS + MySQL）全量重构。

## 现状基线

| 资产/能力 | 状态 | 证据 |
|---|---|---|
| 根级 pnpm workspace 与统一脚本 | 已有 | 根 `package.json`、`pnpm-workspace.yaml` |
| Docker 编排（MySQL/Redis，开发期） | 已有 | `docker-compose.yml`（3308/6380） |
| backend NestJS+Fastify 骨架与健康检查 | 已有 | `backend/` + `GET /api/health` 200 |
| backend Prisma MySQL schema/migration/seed | 已有 | `backend/prisma/`，migration 已应用 |
| backend 日志底座（app/error/debug） | 已有 | `backend/src/log-streams.ts` |
| frontend React+Vite 骨架 | 已有 | `frontend/` builds 通过 |
| 旧代码（`backend/server.js`、`app/`） | 已有但替换 | 未被新代码引用，随重构移除 |
| desktop Electron 壳 | 缺失 | `desktop/` 不存在 |
| RPA Agent（HTTPS 领取/Chrome唤起/采集） | 缺失 | 需新建 |
| Python 运行时内置（安装包） | 缺失 | 需随 desktop 打包 |
| 依赖安装与运行环境探测（Node/pnpm/Electron/Chrome/Python/Prisma/Docker） | 缺失 | 根 workspace 无 desktop；无 check-env 脚本 |
| Redis/BullMQ 队列与 Worker 接入 | 缺失 | backend 未接入队列 |
| 服务端用户/权限/任务/AI/报告/OSS | 缺失 | 需在骨架上补齐 |
| 服务端部署（Nginx/PM2/MySQL/Redis/OSS） | 缺失 | 需按新职责落地 |
| Agent 注册/领取/租约/外部完成契约 | 缺失 | 需在 Phase 2/3 新建 |
| 数据导入 API（mysql-import 收编） | 缺失 | 需在 Phase 3/4 新建 |

> 统一说明：以上“已有”资产最初按 `2026-09-07` 方案建成，均为通用地基（workspace/NestJS/Prisma/日志/frontend），与新方案（`2026-09-10`）兼容，直接复用，**无需整体回滚或删除**。其中 Prisma 初版、健康检查、日志流和环境变量示例仍需按下方“未提交骨架审查收口项”修正。旧方案目录已归档至 `docs/开发任务/归档/`。

## 未提交骨架审查收口项（2026-09-12）

| 项目 | 处理建议 | 归属 | 状态 |
|---|---|---|---|
| backend 构建失败 | 修正 `backend/src/log-streams.ts` 中 `pino.transport()` 与 `multistream` 的类型组合；`pnpm --filter backend build` 必须先恢复通过 | Phase 0 | pending |
| 日志目录落盘 | 启动日志流前递归创建 `backend/logs/`；单个日志文件超过 5 MB 后按既定策略处理，首次启动不能因目录不存在失败 | Phase 0 | pending |
| 健康检查契约 | 从仅有 `/api/health` 调整为 `/api/health/live` 与 `/api/health/ready`；ready 需要检查 MySQL/Redis 等实际依赖 | Phase 0/6 | pending |
| CORS 配置 | 从单个 `FRONTEND_ORIGIN` 调整为集中白名单：生产允许 `app://` 与线上管理后台域名，开发环境追加 `http://127.0.0.1:5173`；`file://` 仅临时兼容 | Phase 1 | pending |
| 环境变量事实源 | 补齐 `backend/.env.example` 的完整服务端配置，明确 backend `.env` 为新架构加载入口；根 `.env.example` 与旧 `app/.env.local` 只保留清晰的迁移/开发说明 | Phase 0/6/7 | pending |
| Prisma 初版模型 | 不把当前 migration 当最终模型；按 design 数据库全景重建，重点处理通用 `Job`、Agent、ProviderProfile、MediaAsset、采集快照、审核记录、`attemptKey` 等 | Phase 1 | pending |
| 提交边界 | 旧 `app/`、`backend/server.js` 暂不删除，保留到 Phase 7；新骨架可复用，但旧入口不得继续作为新系统正式执行入口 | Phase 7 | pending |
| 文档是否入仓 | 当前 `.gitignore` 的 `docs/*` 会忽略架构方案；提交前确认是否取消该忽略规则或对正式方案目录增加反向匹配 | 仓库治理 | pending |

## 历史代码迁移与功能收口

| 旧资产 | 迁移/收口方式 | 归属 |
|---|---|---|
| `app/src/server/taobaoTopClient.js` | Phase 4.3 建新适配器，Phase 7 迁移旧类目/店铺/开放平台配置能力 | Phase 7 |
| `app/src/server/mainImagePromptExpansion.js`、`arkImageGeneration.js` | Phase 4.5 建新流程，Phase 7 迁移旧提示词/生图逻辑 | Phase 7 |
| `skills/diantoushi-product-research`、`mysql-import`、`market-analysis-report` | Phase 3/4 建调用基础，Phase 7 全量适配为 Agent 技能与服务端输入 | Phase 7 |
| `app/src/server` 的用户/角色/菜单/按钮/店铺/部门/账号/平台管理等 | Phase 1 建新服务，Phase 7 迁移旧逻辑 | Phase 7 |
| 旧 MySQL 表（`sys_user`、`sys_role`、`product_snapshot`、`market_analysis_run` 等） | 从 0 建新库；旧表只作字段语义参考，不迁移数据 | 不迁移 |
| `app/public/generated/product-sets` 等本地资产生成物 | Phase 5 建存储能力，Phase 7 迁移到 OSS 或转为旧数据引用并清理 | Phase 7 |
| `app/src/app/pages`（报告、主图/详情图、图库、平台商品、数据下载、看板、视频复刻等） | 全部迁移至新 frontend/desktop，按新架构改造 | Phase 0 输出矩阵、Phase 7 全量迁移 |
| 旧环境变量（`OPENROUTER_*`、`ARK_ANALYSIS_*`、`TAOBAO_*`、`MYSQL_*` 等） | 2026-09-12 已录入同事提供的 AI/模型参考值（`app/.env.example` 已有，`backend/.env.example` 同步补齐）；Phase 6 建部署配置，Phase 7 收敛到 backend `.env` 并逐项校验 | Phase 6/7 |
| 旧服务进程与端口 | 新服务上线后旧进程停止、域名/端口切换、回滚预案演练 | Phase 7 |

> 说明：旧 MySQL 数据不迁移；上表所有旧能力最终统一由 Phase 7 全量迁移与收口；Phase 0-6 中的相关任务只负责在新方案中建立对应基础能力，不视为迁移完成。

## 阶段状态表

| Phase | 阶段 | 前置依赖 | 独立交付判据 | 状态 |
|---|---|---|---|---|
| 0 | 桌面端工程、依赖安装与基础壳 | 无 | electron-vite 构建成功、窗口可启动；内置 Python 可运行 `skills/`；依赖安装与运行环境探测通过 | pending |
| 1 | 服务端用户与权限 | 骨架已有 | 登录/用户管理/权限 200/403；Prisma 覆盖 design 数据库全景模型 | pending |
| 2 | Redis/BullMQ FlowProducer 任务与轻量工作流 | Phase 1 | FlowProducer 流程树、任务幂等、排队、Agent 领取/租约/外部完成、检查点续跑、阶段进度、SSE | pending |
| 3 | RPA Agent | Phase 0、Phase 2 | Agent 注册/claim/心跳/complete、唤起 Chrome、提交结果、数据导入通道 | pending |
| 4 | AI、报告与下游工作流 | Phase 2（OSS/平台先用 mock） | 报告完整，图片生成（含结果 review）与平台发布流程树可跑通 | pending |
| 5 | 资产与 StorageDriver | Phase 1 | StorageDriver 接口 + mock 通过；OSS 厂商补齐后只改实现 | pending |
| 6 | 打包更新与服务端部署 | Phase 0-5 | 安装包可安装（含 Python）、GitHub Actions 多平台产物、GitHub Releases 更新可用、阿里云部署 | pending |
| 7 | 历史功能全量迁移与收口 | Phase 0-6 | 旧 app/ 功能全部迁移或按新方案改造；旧资产、配置、服务收口（不迁旧数据） | pending |
| 8 | 测试与最终验收 | Phase 0-7 | 单测/E2E/端到端联调与检查点续跑验收通过 | pending |

## 全局里程碑

| 里程碑 | 完成标准 |
|---|---|
| M1 桌面端跑通 | Electron 窗口 + 登录服务端成功 |
| M2 服务端闭环 | 用户/权限/BullMQ 任务与 SSE 可验证 |
| M3 RPA 闭环 | Agent 领取任务、拉起 Chrome 并上报 |
| M4 业务闭环 | AI(mock) 报告、图片生成与平台发布流程树完整 |
| M5 资产闭环 | StorageDriver 抽象 + mock 闭环；OSS 补齐后接入 |
| M6 部署闭环 | 内置 Python 安装包 + GitHub Actions macOS/Windows 产物 + 可配置更新源演练（最终主源待定） + 阿里云服务端部署 |
| M7 迁移闭环 | 旧功能、旧资产、旧配置、旧服务全部迁移收口（不迁旧数据） |
| M8 验收闭环 | 单测/E2E/端到端联调、检查点续跑与人工审核全绿 |

## 方案待修订项

- [ ] AI/淘宝 SDK 参数、超时、限流在 Phase 4 前回填 `[待实测]` 结论。
- [ ] 同事提供的 AI/模型环境变量参考值已录入（2026-09-12）：仅作初值，`OPENROUTER_API_KEY` 为占位符；原文件未包含 `ARK_API_KEY`，旧代码实际读取该变量（缺省回退 `OPENAI_API_KEY`），Phase 4 前按实测回填模型/超时/限额并迁入 ProviderProfile。
- [ ] BullMQ 队列名称、并发数、任务保留时间与有限重试策略：已给初稿默认值（见 design.md「第一版参数默认值」），Phase 2 开发时按实测调整。
- [ ] BullMQ FlowProducer 流程树：已明确按场景固定模板编排（分析/图片生成/平台发布各一棵），FlowProducer 基础组合能力不开放业务级自由组树；阶段状态转移在 Phase 2 前确认。
- [ ] 分析任务之后的“图片生成”与“平台发布”任务类型、触发方式与状态机在 Phase 2 前确认；独立于分析任务，不强制串联。
- [ ] 跨场景自动串联配置（分析→图片生成→平台发布）在 Phase 2 前确认。
- [ ] `Job` 创建时固化 `providerProfileId`，运行中的任务不因后台切换供应商而改变调用配置；Phase 2 与 Phase 4 联合验证。
- [ ] 线上 OSS 厂商/区域、dev/prod bucket：开发环境已用本地目录方案，线上接入前补齐；StorageDriver 已抽离，只需补实现与配置。
- [ ] OSS 开发/生产目录前缀、预签名上传和 confirm 接口在 StorageDriver 中占位，厂商确认后回填。
- [ ] 采集图片哪些必须归档到 OSS、哪些只保留 sourceUrl，在 Phase 5 前确认。
- [ ] 架构图按最新轻量工作流重新生成（BullMQ FlowProducer + Agent 外部完成 + StorageDriver 环境路由），当前以 `架构图.md`、`design.md` 和正式 `架构图.archify.json/html` 为准。
- [ ] 自动更新源：GitHub Releases / 阿里云静态源待专门讨论（2026-09-12 记录）；Phase 0/6 只做配置占位和可替换适配，不视为最终选型。
- [ ] Windows 冒烟验收：优先在 mac 上安装 Windows 虚拟机；虚拟机就绪后再验证安装、启动、登录与 RPA（CDP），未就绪前暂不验证，不阻塞开发。
- [ ] 旧 `app/` 功能全部迁移：Phase 0.6 输出页面/模块迁移矩阵，Phase 7 全量迁移与收口。
- [ ] Agent 领取/心跳/租约默认参数：已给初稿默认值（claimDeadline 60s、leaseTtlMs 120s、heartbeatIntervalMs 15s），Phase 2 开发时按实测调整。
- [ ] 结果 review 的“重新生成”次数上限：初稿默认 3 次，Phase 4 开发时按实测调整。
- [x] 已归档 `workflow-candidate.json` 与旧 `架构图-完整.archify.json`；正式目录只保留当前 `架构图.md`、`design.md`、`架构图/架构图.archify.json/html` 及其验证产物。

## 方案已确认决策（2026-09-12）

- [x] 内置 Python 具体方案：python-build-standalone（install_only_stripped，固定版本）+ uv（仅构建期）+ electron-builder `extraResources`；不内置 shell；依赖构建期预装锁定，详见 design.md「六、RPA Agent」「十一、桌面端打包与更新」。
- [x] Python 版本：全平台统一锁定 3.12.x 具体版本（如 3.12.14 + standalone 发布 tag），不按平台分版本。
- [x] RPA 浏览器控制归属：Node 主进程以 RPA 专用 profile 启动 Chrome 并暴露 CDP 端口，Python 采集技能经 CDP 附加；内置 Python 依赖含 `playwright`（wheel），Node playwright 用于登录引导与 UI E2E；mac AppleScript/Swift 路径收口为 CDP。
- [x] Python 环境统一：桌面端内置运行时是统一 Python 工具环境，业务需要新增的 Python 工具（包括报告分析用 pandas 等）统一内置，不做桌面端/服务端分头维护。
- [x] 原生 C 扩展准入：仅进依赖清单（锁版本 + hash），优先纯 Python 替代；mac arm64/x64 与 Windows x64 全平台探针 + 干净机器安装冒烟通过后才合入。
- [x] Python 体积策略：以功能与稳定性为准，不追求激进裁剪；install_only_stripped 解压约 60MB 作为基线，新增原生库接受包体增长并走全平台验收，详见 design.md「十一、桌面端打包与更新」。
- [x] AI 供应商扩展：统一 `AiProvider` 接口（按能力拆分）+ 供应商注册表 + 配置切换；第一版每能力只启用一个供应商，不做自动路由/容灾，详见 design.md「九、外部依赖边界」。
- [x] AI 自定义端点：第三方 key + baseURL + model 统一走 `OpenAICompatibleProvider`（通用 HTTP Provider）；key 只存服务端，用户自带 key（BYOK）第一版不做。
- [x] AI 多配置实例：拆分 `AiProvider` 代码适配器与 `ProviderProfile` 配置实例，支持多个厂商、多个 key/baseURL；后续管理后台通过 `ProviderRouter` 切换，任务固定记录 `providerProfileId`。
- [x] 自定义端点安全：ProviderProfile 的 baseURL 仅允许 HTTPS；生产禁止 localhost、127.0.0.1、内网/metadata 地址和危险协议；连接测试与保存时执行 SSRF 校验。
- [x] CORS 白名单：生产允许 `app://` 与线上管理后台域名，开发环境追加 `http://127.0.0.1:5173`；`file://` 仅 Phase 0 临时兼容。
- [x] 存储环境区分：本地开发环境用项目内本地目录（LocalStorageDriver），线上用 OSS；OSS 后续有环境再调试，业务只依赖 StorageDriver。
- [x] SQLite 清理默认值：启动时执行、运行期间每 6 小时执行；本地终态任务记录和事件保留 30 天，终态临时文件默认保留 7 天；设置页提供 1/3/7/30 天选项，默认 7 天；本地临时目录上限 2 GB；运行中/待执行任务与 token、配置、浏览器 profile 不自动清理。
- [x] 旧报告 skill 收口：`market-analysis-report` 仅作迁移参考，不作为新系统正式执行入口；报告逻辑唯一归属 backend。

## 阻塞登记

当前无阻塞。开发期 Docker 端口（3308/6380）已避开本机其他项目占用。
