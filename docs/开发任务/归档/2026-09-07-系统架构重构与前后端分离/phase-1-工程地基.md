# Phase 1：工程地基与基础设施

- [x] 1.1 建立根级 pnpm workspace 与统一脚本
      现状: 根目录缺少 `package.json`、`pnpm-workspace.yaml`、`frontend/` 和统一脚本；旧前端位于 `app/`
      依据: 图1-A1、图1-A2、图1-A3、图1-A4、design.md「工程组织决策」
      验证: `pnpm install --lockfile-only` ➔ 预期: 根级生成唯一 lockfile，workspace 识别 `frontend` 和 `backend`
      证据: (2026-09-09，`pnpm install` 成功，workspace 识别 `frontend`/`backend`，生成根级 `pnpm-lock.yaml`)

- [x] 1.2 编排本地 MySQL 与 Redis
      现状: 根目录无 `docker-compose.yml`，本地基础设施未统一
      依据: 图1-B3、图1-B4、design.md「首次安装与初始化」
      验证: `docker compose up -d mysql redis && docker compose ps` ➔ 预期: MySQL、Redis 状态为 running/healthy
      证据: (2026-09-09，`docker compose up -d mysql redis` 成功；MySQL 映射 3308、Redis 映射 6380，容器进入 healthy)

- [x] 1.3 创建 NestJS + Fastify 后端骨架和健康检查
      现状: `backend/server.js` 为旧 Node HTTP 单体，本轮不保留兼容层
      依据: 图1-A2、图1-B7、架构图「唯一权威判据表」后端就绪
      验证: `pnpm --filter backend build && curl -i http://127.0.0.1:8787/api/health` ➔ 预期: 构建成功，接口返回 200 且 MySQL/Redis 状态字段为 up
      证据: (2026-09-09，`pnpm --filter backend build` 成功；`curl -i http://127.0.0.1:8787/api/health` 返回 HTTP/1.1 200，响应 `{"ok":true,"status":"up"}`)

- [ ] 1.4 创建 React + Vite 前端工程并配置 API 代理
      现状: 新 `frontend/` 缺失，旧 `app/` 依赖服务端 mysql2，不作为新工程
      依据: 图1-A1、图1-A3、design.md「工程组织决策」
      验证: `pnpm --filter frontend build` ➔ 预期: `frontend/dist` 生成且构建无 mysql2 等服务端依赖错误
      证据: 

- [x] 1.5 建立 Prisma Schema、Migration 和 Seed
      现状: 新 Prisma schema、数据库表、迁移和基础数据均缺失
      依据: 图1-B3、design.md「数据库全景」
      验证: `pnpm --filter backend db:migrate && pnpm --filter backend db:seed` ➔ 预期: migration 成功，基础租户、管理员、角色、权限和平台字典可查询
      证据: (2026-09-09，Prisma migration `20260909085940_init` 创建并应用成功；Seed 输出“租户 default，管理员 admin，平台 4 个”)

- [ ] 1.6 建立统一 DTO、错误处理和结构化日志底座
      现状: 旧后端自行处理 JSON 和错误，新 NestJS 全局校验、异常过滤器和 Pino 配置缺失
      依据: 图1-B7、design.md「日志与可观测性」
      验证: `curl -i -X POST http://127.0.0.1:8787/api/test-invalid` 并检查 `backend/logs/app.log`、`error.log`、本地 `debug.log` ➔ 预期: 非法 DTO 返回统一错误结构，日志含 requestId 且无 Token/Key，单文件上限 5 MB
      证据: 
