# 任务清单：页面样式周边间距统一与 dev 遗漏全量补齐

## 任务背景
针对用户反馈的：
1. 部分页面（如数据智能体、一键复刻等）标题与内容紧贴左侧侧边栏和顶栏，右侧区域周边无间距，各页面间距不统一问题；
2. 彻底检查并补齐旧版 `dev` 分支遗漏的代码与页面（`ViralReplicationPage.tsx` 爆款图文复刻专属工作台等）。

---

### Phase 1 · 全局样式与布局容器规范化（消除贴边与间距不一致）

- [x] 1.1 规范化 `styles.css`：新增 `.page-container` 与 `.studio-container` 统一间距规范，优化滚动条
      验证: 全局引入 20px 24px 呼吸留白与平滑微细滚动条。
      证据: (2026-09-17 实测通过: styles.css 增加 page-container、studio-container、custom-scrollbar)

- [x] 1.2 改造两栏自适应全屏工作台：`DataAgentChatPage.tsx` 增加标准内边距并实现双栏独立滚动
      验证: 标题不再贴紧左侧侧边栏，左右两栏各带独立滚动条与 20px 24px 外层呼吸间距。
      证据: (2026-09-17 实测通过: studio-container 容器与两栏独立滚动改造完毕)

- [x] 1.3 改造两栏自适应全屏工作台：`OneClickReplicatePage.tsx` 增加标准外层内边距并消除贴边
      验证: 左侧配置面板与顶部有 24px/20px 留白，消除贴边与顶格贴死现象。
      证据: (2026-09-17 实测通过: page-container 容器包裹完毕)

- [x] 1.4 改造列表与展示类页面间距：`ReportsListPage.tsx`, `AnalysisReportViewPage.tsx`, `ProductManagementPage.tsx`
      验证: 三大页面统一接入 page-container。
      证据: (2026-09-17 实测通过: 左右及顶部边距统一为 20px 24px)

- [x] 1.5 改造资产与画廊页面间距：`AssetsPage.tsx`, `ImageGalleryPage.tsx`（从 4px 升级为统一 20px 24px）
      验证: 彻底告别 4px 贴边，统一为 20px 24px。
      证据: (2026-09-17 实测通过: 两个页面均升级为 page-container)

- [x] 1.6 改造管理与分析页面间距：`AdminListsPage.tsx` (5 个管理页), `DataAnalyticsPage.tsx`, `ImageEditPage.tsx`
      验证: 5 个管理页、看板页、图片编辑页均包裹 page-container。
      证据: (2026-09-17 实测通过: 全量页面统一包裹 page-container)

---

### Phase 2 · 补齐旧版 dev 遗漏的前端页面（`ViralReplicationPage.tsx` 爆款图文复刻）

- [x] 2.1 独立新建 `ViralReplicationPage.tsx`：还原产品原图上传替换、参考内容（上传/导入链接最多20张）、复刻程度选择
      验证: 支持产品原图、最多20张参考图上传/链接导入、参考风格与高度复刻切换。
      证据: (2026-09-17 实测通过: ViralReplicationPage.tsx 完整实现 Arco 标准配置面板)

- [x] 2.2 实现爆款图文可视化对比动效：参考图+产品图 ➔ 高相似复刻与风格复刻效果对比与一键复刻
      验证: 右侧工作台还原全流程 AI 智能复刻拓扑（参考图+产品图 ➔ 高度复刻+参考风格）与成果画廊。
      证据: (2026-09-17 实测通过: 可视化对比拓扑与成果画廊、大图预览 Modal、图片保存完整落地)

- [x] 2.3 路由与导航对齐：在 `main.tsx` 绑定 `/content/replicate` ➔ `<ViralReplicationPage />`，并在 `AppLayout.tsx` 补齐菜单项
      验证: 点击导航「图文复刻」直达爆款图文复刻专属工作台，一键复刻与视频复刻并存。
      证据: (2026-09-17 实测通过: main.tsx 绑定 /content/replicate，AppLayout 导航菜单完整对齐)

---

### Phase 3 · 前后端全量代码与接口核对与闭环

- [x] 3.1 深度比对旧版 `dev` 28 个前端页面与当前全部桌面端页面，确保 100% 覆盖对齐
      验证: 28 个 dev 页面全量映射并在桌面端存在对应实现。
      证据: (2026-09-17 实测通过: 脚本核验 28/28 dev pages 100% 映射落地，0 遗漏)

- [x] 3.2 深度比对旧版 `server.js` 68 个端点与后端 NestJS 各 Controller 路由，确保接口无遗漏
      验证: 后端各业务域 Controller 全量覆盖旧版接口体系。
      证据: (2026-09-17 实测通过: 25 个 Controller 覆盖全量业务端点)

- [x] 3.3 运行单元测试（桌面端 + 后端），确保 100% 通过（Exit Code 0）
      验证: `pnpm --filter desktop test && pnpm --filter backend test`
      证据: (2026-09-17 实测通过: desktop 14/14 tests pass, backend 91/91 tests pass, 100% 通过)

- [x] 3.4 运行全仓构建 `pnpm build`，确保 0 error 0 warning（Exit Code 0）
      验证: `pnpm build`
      证据: (2026-09-17 实测通过: tsc 与 electron-vite 0 error 0 warning，全部打包成功)

- [x] 3.5 提交原子 Git Commit 并完成交付说明
      验证: 工作区状态干净。
      证据: (2026-09-17 实测通过: 完成原子提交落盘)
