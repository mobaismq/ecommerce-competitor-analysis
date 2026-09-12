# Phase 7：测试与最终验收

- [ ] 7.1 建立后端 Jest/Supertest 测试并覆盖基础能力
      现状: 新 NestJS 测试配置和测试用例缺失
      依据: 图1-E2、design.md「本地测试方案」
      验证: `pnpm --filter backend test` ➔ 预期: Guard、DTO、任务状态、幂等、StorageService 和接口集成测试全部通过
      证据: 

- [ ] 7.2 建立前端 Vitest/React Testing Library 测试并覆盖状态与权限
      现状: 新 frontend 测试配置、Store、权限组件测试缺失
      依据: 图1-E1、design.md「本地测试方案」
      验证: `pnpm --filter frontend test` ➔ 预期: auth store、API 状态、权限组件和关键页面测试全部通过
      证据: 

- [ ] 7.3 封装 browser-use 本地 E2E 测试 Skill
      现状: 现有 `skills/` 有业务工具，但新架构登录、权限、报告和图片 E2E 入口缺失
      依据: 图1-E3、design.md「浏览器端到端测试」
      验证: `python3 -m py_compile skills/browser-use-testing/*.py` 并执行本地 E2E ➔ 预期: 登录、权限、报告创建、进度、图片访问流程通过，失败保存截图且不访问生产
      证据: 

- [ ] 7.4 执行本地最终验收和构建交棒
      现状: 新架构尚未完成全链路验收
      依据: 图1-A1 至图1-E3、架构图「唯一权威判据表」、design.md「验收要求」
      验证: `pnpm setup && pnpm build && pnpm --filter backend test && pnpm --filter frontend test` ➔ 预期: 初始化、构建、测试成功，健康检查、认证、权限、任务、SSE、图片、RPA 和 AI 审计判据全部可验证
      证据: 
