# Phase 7 · 资产生成与复刻收口

> 归属旧页面（3 个）：AssetLibrary（未注册路由）、OneClickReplicate（一键复刻）、ViralReplication（复刻）
> 目标：处理旧系统中「纯 mock / 未注册」页面的收口决策并落地；修正 `/content/one-click-replicate` 被误复用视频复刻页的语义错误。
> 前置：P3 图片生成工作流能力（一键复刻若接入真实生图需依赖 P3）。

---

- [ ] 7.1 修正一键复刻/复刻路由语义
      现状: `apps/desktop/src/renderer/src/main.tsx` 中 `/content/one-click-replicate` 误复用 `VideoReplicatePage`（视频复刻），与旧 OneClickReplicate/ViralReplication 语义不符；`/content/replicate` 为 StubPage。
      依据: 架构图-图1 A2；页面迁移矩阵 `/content/replicate`、`/content/one-click-replicate`
      验证: 决策「接入 P3 生图能力」或「保留 demo 入口并明确标注未接入」→ 修正路由后 `pnpm --filter frontend build` ➔ 预期: 一键复刻/复刻各自路由语义正确，不再误指向视频复刻。
      证据: (执行阶段回填)

- [ ] 7.2 AssetLibrary 收口（补路由或裁剪）
      现状: 旧 AssetLibrary 未注册路由；新 `/assets` 已由 AssetsPage 承接资产库能力。
      依据: 页面迁移矩阵「AssetLibrary 迁移或裁剪前人工确认」
      验证: 决策后落地（独立页补路由，或确认 AssetsPage 已覆盖并裁剪旧文件）→ `pnpm --filter frontend build` ➔ 预期: 无重复资产入口，旧 AssetLibrary 有明确归属。
      证据: (执行阶段回填)

- [ ] 7.3 复刻类页面接入图片生成能力或标注 demo
      现状: 旧 OneClickReplicate/ViralReplication 为纯 mock demo（本地 generating 状态模拟、静态参考图）。
      依据: tasks.md「方案待修订项-一键复刻/复刻」
      验证: 若接入 P3：`pnpm --filter frontend build` + 走通"选商品→参考图→生图→预览下载"；若保持 demo：页面显著标注"演示，未接入真实生图" ➔ 预期: 无静默的假功能，迁移语义明确。
      证据: (执行阶段回填)