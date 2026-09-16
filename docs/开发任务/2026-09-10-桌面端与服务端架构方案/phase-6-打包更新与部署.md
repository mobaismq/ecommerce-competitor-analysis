# Phase 6：打包、更新与服务端部署

## 执行顺序（2026-09-15 确认）

- Phase 6 实际执行顺序后置：先完成本地功能（Phase 0-5）与历史功能迁移收口（Phase 7），再执行打包、更新与服务端部署，最后进入 Phase 8 测试与最终验收；任务编号保留 `6.x`，避免大量重编号与跨文档引用调整。
- 打包分两级推进（双轨发布）：
  - 一级「本地内测包」：本地机器构建 macOS/Windows 安装包（含内置 Python），人工分发给真实用户试用，确认用户意向、收集反馈；不接自动更新，不依赖线上服务。
  - 二级「线上正式包」：确认意向后再配置 GitHub Actions 多平台构建、GitHub Releases、自动更新源与服务端（阿里云）部署。
  - 顺序红线：本地功能与内测包先通过，再进入线上正式发布；线上相关事项无论人工还是 AI 执行，均落到本节「本地做/线上做清单」，避免遗忘。

## 本地做 / 线上做清单（待逐项回填）

| 事项 | 执行位置 | 负责人 | 归属任务 | 状态 |
|---|---|---|---|---|
| 本地功能开发与冒烟验证 | 本地 | AI + 人工 | Phase 0-5 | 进行中 |
| 本地内测包构建（含 Python） | 本地 mac/Windows | AI + 人工 | 6.0/6.1 | pending |
| 真实用户试用与意向确认 | 用户侧 | 人工 | 6.0 | pending |
| dev/prod 环境变量注释与线上配置对照 | 本地文档 + 线上 | AI | 6.7 | pending |
| 正式 AI Key（OpenRouter/Ark）与淘宝开放平台 Key 获取 | 各平台账号 | 人工 | 4.7/6.7 | pending |
| 域名、Nginx、HTTPS 证书 | 阿里云/服务器 | 人工 | 6.2 | pending |
| 阿里云 ECS/MySQL/Redis/PM2 部署 | 线上 | AI + 人工 | 6.2/6.3 | pending |
| GitHub Actions secrets / Releases token | GitHub 仓库设置 | 人工 | 6.5 | pending |
| macOS Developer ID / Windows 签名证书 | 开发者账号 | 人工 | 6.6 | pending |
| OSS bucket、region、预签名域名 | 阿里云 OSS | 人工 | Phase 5/6.2 | pending |
| 自动更新源最终选型 | 待讨论 | 人工 | 6.1/6.5 | pending |
| Windows 虚拟机冒烟 | mac + 虚拟机 | 人工 | 6.5/6.8 | pending |
| 正式服务切换：旧服务停止、域名/端口切换 | 线上 | AI + 人工 | 6.4 | pending |

- [ ] 6.1 完成桌面端安装包（含 Python）与自动更新配置占位演练
      现状: 打包配置已建，未产出与演练；Python 运行时待内置
      依据: 图1-A4、图1-A6、design.md「十一、桌面端打包与更新」
      验证: 发布 v0.0.1 安装（无系统 Python）➔ 预期: 安装成功，Agent 经 `spawn`（shell:false）可调用内置 Python 与 `skills/`；`resources/python` 递归打包完整，`bin/python3` 符号链接/执行权限正常；更新源只验证可配置和可替换，当前不把 GitHub Releases/阿里云静态源视为最终选型；保留本地配置
      证据:

- [x] 6.0 明确双轨打包节奏与 Phase 6 后置执行顺序
      现状: 任务清单中 Phase 6 排在 Phase 7 之前，且只有一份“线上级”打包目标，未区分本地内测包与线上正式包
      依据: 2026-09-15 人工确认：本地功能/迁移完成后再打包部署；先本地内测包确认用户意向，再线上正式发布
      验证: `tasks.md` 阶段表与本文档生效 ➔ 预期: Phase 6 后置说明、本地内测包→线上正式包两级目标、本地做/线上做清单均已记录
      证据: (2026-09-15, 已完成：`tasks.md` 阶段表按 0→5→7→6→8 后置 Phase 6，本文档头部记录双轨发布与本地做/线上做清单)

- [ ] 6.2 落地服务端生产部署（阿里云 Nginx + PM2 + MySQL + Redis/BullMQ Worker + StorageDriver）
      现状: 服务端部署未落地；阿里云 99 元单机方案
      依据: 图1-D4、图1-D5、design.md「十、日志与可观测性」「十一」
      验证: `curl -i https://<域名>/api/health/ready` 且 Redis 健康检查通过 ➔ 预期: 200，健康检查、日志落盘、PM2 守护、BullMQ Worker 消费正常、SSE 代理参数生效
      证据:

- [ ] 6.3 完成服务端备份与回滚预案
      现状: 无备份/回滚流程
      依据: design.md「十三」
      验证: 演练备份 MySQL 与回退上一版本 ➔ 预期: 数据可恢复，服务可回滚
      证据:

- [ ] 6.4 完成旧环境变量与旧服务切换准备
      现状: 旧 `.env` 配置与旧服务进程切换未安排；新服务仍存在根 `.env.example` 与 `backend/.env.example` 双示例，加载入口未唯一化
      依据: tasks.md「历史代码迁移与功能收口」
      验证: 新服务上线后旧服务停止、域名/端口切换成功；新服务统一从 `backend/.env` 加载配置，环境变量示例只有一份事实源；旧 `app/.env.local` 仅作迁移期兼容；旧环境变量逐项校验（不迁移旧 MySQL 数据）
      证据:

- [x] 6.7 补齐 dev/prod 环境变量注释与线上配置对照
      现状: `backend/.env.example` 已有初值，但本地地址、线上地址、AI Key 获取方式等缺少逐项说明；桌面端无独立示例
      依据: 2026-09-15 人工确认：本地开发地址写 env 并注释，线上照着配置；正式 Key 不提交 git
      验证: `backend/.env.example` 与 `desktop/.env.example` 逐项含开发/生产对照注释（含 AI/淘宝/OSS/更新源/同步开关/本地目录/对外地址）；线上部署按注释可直接生成各自 `.env`；Key 类仅占位符；根 `.env.example` 仅作指向说明
      证据: (2026-09-15, 已完成：`backend/.env.example`、`desktop/.env.example` 已补齐 dev/prod 注释，根 `.env.example` 仅保留指向；`single-implementation-smoke` 校验 rootIsPointerOnly/rootHasNoDuplicate/desktopEnvHasSync 通过)

- [x] 6.8 盘点线上/人工事项并逐项回填
      现状: OSS、域名证书、签名证书、Actions secrets、更新源、Windows 虚拟机、正式 Key 等线上/人工事项分散在文档，未集中成清单
      依据: 2026-09-15 人工确认：线上事项无论人工还是 AI 做，都要记录到任务清单
      验证: 本文档「本地做/线上做清单」每项均有负责人、归属任务、状态；未完成项在 `tasks.md` 中可追踪
      证据: (2026-09-15, 已完成：phase-6「本地做/线上做清单」与 `待办事项清单.md` 第四节均已登记并保持可追踪)

- [~] 6.5 配置 GitHub Actions 多平台打包（macOS/Windows）并完成 Windows 冒烟
      现状: 只有 macOS 开发机，无 Windows 机器；electron-builder 未配置 CI 矩阵
      依据: design.md「十一、桌面端打包与更新」；electron-builder 官方 GitHub Actions 文档、`Zettlr`/`marktext`/`electron-vite-vue` 真实案例
      验证: 推送 tag 后 Actions 矩阵按 os/arch（macOS arm64/x64、Windows x64）产出 `dmg` 与 Windows `exe`（含 `latest.yml`/`blockmap`），且各产物内置对应架构的 standalone Python 资产；发布 GitHub Releases；Windows 冒烟优先在 mac 的 Windows 虚拟机上验证，虚拟机就绪前暂不验证；免费额度可支持低频发版
      证据: (2026-09-15, 配置已落地：新增 `.github/workflows/release-desktop.yml`，矩阵 macos-14(arm64)/macos-13(x64)/windows-latest(x64)，构建 backend/frontend/desktop、prepare-python、electron-builder 发布（tag 自动 publish，dispatch 仅 artifact），Ruby YAML 校验通过；真实 Actions 运行需推送仓库 + `UPDATE_URL` secret，Windows 冒烟待虚拟机，任务保持 `[~]`)

- [ ] 6.6 接入正式应用图标与签名资源
      现状: 当前使用 Electron 默认图标，无正式签名证书；设计师交付清单见 `桌面端图标设计规格.md`
      依据: `桌面端图标设计规格.md`、design.md「十一、桌面端打包与更新」
      验证: macOS 使用 `build/icon.icns`、Windows 使用 `build/icon.ico`、Linux 使用 `build/icons`；安装包/应用内不再出现默认 Electron 图标；有正式 Developer ID / Windows 签名证书后恢复真实验签
      证据:
