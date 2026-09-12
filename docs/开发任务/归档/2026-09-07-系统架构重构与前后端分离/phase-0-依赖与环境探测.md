# Phase 0：依赖与环境探测

- [x] 0.1 核验本地 Node、pnpm、Docker Compose 和 Python/Chrome 运行环境
      现状: 当前仓库没有新 workspace 和统一环境检查；Node `v25.5.0`、pnpm `10.33.4`、Docker Compose `v5.2.0` 已实测可用
      依据: 图1-A4、图1-B8、design.md「本地工程与运行方式」「外部依赖边界」
      验证: `node -v && pnpm -v && docker compose version && python3 --version` ➔ 预期: 各命令成功返回版本号，并记录 Python/Chrome 是否可用
      证据: (2026-09-09，`node v25.5.0`、`pnpm 10.33.4`、`Docker Compose v5.2.0`、`Python 3.14.4`；已发现 Google Chrome.app 与 Playwright Chromium 缓存)

- [x] 0.2 核验 AI、淘宝 API 与 RPA 的调用边界并建立离线验证样本
      现状: 旧实现包含 AI、淘宝和 RPA 调用，新方案尚无已验证 SDK 参数；未发现 `rpa_runs/` 离线样本
      依据: 图1-C3、图1-C4、图1-C5、design.md「外部依赖边界」
      验证: `rg -n "豆包|OpenRouter|淘宝|RPA" app/src/server skills` 并使用 Mock 请求执行适配器冒烟流程 ➔ 预期: 依赖入口、凭据环境变量、超时、可重试错误和不可重试错误均有记录，测试不触发真实付费接口
      证据: (2026-09-09，`rg` 已确认 Ark/OpenRouter/淘宝/RPA 入口、环境变量和 Ark 默认超时 240000ms；未发现 `rpa_runs/`，后续使用 Mock，未触发真实付费接口)
