# Phase 7 · 资产生成与复刻收口

> 归属旧页面（3 个）：AssetLibrary（未注册路由）、OneClickReplicate（一键复刻）、ViralReplication（复刻）
> 目标：处理旧系统中「纯 mock / 未注册」页面的收口决策并落地；修正 `/content/one-click-replicate` 被误复用视频复刻页的语义错误。
> 前置：P3 图片生成工作流能力（一键复刻若接入真实生图需依赖 P3）。

---

- [x] 7.1 修正一键复刻/复刻路由语义
      现状: 路由解耦完成。`/content/one-click-replicate` 与 `/content/replicate` 绑定到 `OneClickReplicatePage`；`/content/video-replicate` 独立绑定 `VideoReplicatePage`，语义清晰无交叉。
      依据: 架构图-图1 A2；页面迁移矩阵
      验证: `pnpm build` 顺利通过；路由导航无误。
      证据: apps/desktop/src/renderer/src/main.tsx

- [x] 7.2 AssetLibrary 与图片库收口
      现状: 资产库 `/assets`（AssetsPage）与图片库 `/assets/images`（ImageGalleryPage）已彻底解耦独立，各自具备专属页面与精准路由匹配（NavLink end）。
      依据: 页面迁移矩阵
      验证: `pnpm build` 成功；点击图片库展示专属画廊与预览，资产库展示全量存储表格。
      证据: AssetsPage.tsx, ImageGalleryPage.tsx, AppLayout.tsx

- [x] 7.3 复刻类页面完整工作台实现
      现状: 废弃原有简陋文字占位，完成 `OneClickReplicatePage` 完整业务工作台建设。左侧支持联动真实商品主档、上传参考图/链接、复刻程度与参数设置；右侧支持未生成三步引导、生成状态过渡与生成后结果画廊（大图预览、下载）。
      依据: 旧 OneClickReplicate 交互还原 + Arco Design 规范统一
      验证: 前端完整渲染且可交互，联动 ProductMasterData，无简陋占位白板。
      证据: OneClickReplicatePage.tsx (500+ 行)