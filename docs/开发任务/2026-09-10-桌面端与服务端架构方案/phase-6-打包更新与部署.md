# Phase 6：打包、更新与服务端部署

- [ ] 6.1 完成桌面端安装包（含 Python）与自动更新配置占位演练
      现状: 打包配置已建，未产出与演练；Python 运行时待内置
      依据: 图1-A4、图1-A6、design.md「十一、桌面端打包与更新」
      验证: 发布 v0.0.1 安装（无系统 Python）➔ 预期: 安装成功，Agent 经 `spawn`（shell:false）可调用内置 Python 与 `skills/`；`resources/python` 递归打包完整，`bin/python3` 符号链接/执行权限正常；更新源只验证可配置和可替换，当前不把 GitHub Releases/阿里云静态源视为最终选型；保留本地配置
      证据:

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

- [ ] 6.5 配置 GitHub Actions 多平台打包（macOS/Windows）并完成 Windows 冒烟
      现状: 只有 macOS 开发机，无 Windows 机器；electron-builder 未配置 CI 矩阵
      依据: design.md「十一、桌面端打包与更新」；electron-builder 官方 GitHub Actions 文档、`Zettlr`/`marktext`/`electron-vite-vue` 真实案例
      验证: 推送 tag 后 Actions 矩阵按 os/arch（macOS arm64/x64、Windows x64）产出 `dmg` 与 Windows `exe`（含 `latest.yml`/`blockmap`），且各产物内置对应架构的 standalone Python 资产；发布 GitHub Releases；Windows 冒烟优先在 mac 的 Windows 虚拟机上验证，虚拟机就绪前暂不验证；免费额度可支持低频发版
      证据:
