# Phase 7：历史功能全量迁移与收口

> 范围：旧 `app/`、旧 `backend/server.js`、旧 `skills/`、旧代码逻辑、本地资产生成物、旧环境变量与服务进程，全部按新方案迁移或改造；旧 MySQL 数据不迁移，从 0 重新建库。

- [ ] 7.1 前端页面全量迁移
      现状: 旧 `app/src/app/pages` 包含登录、报告、分析视图、主图/详情图、图库、资产库、平台商品、手动发布、商品主档、数据下载/运行、数据看板、AI 对话、一键复刻、爆款视频复刻、视频库、账号/角色/店铺管理等页面，尚未全部落到新 frontend/desktop
      依据: tasks.md「历史代码迁移与功能收口」、phase-0-桌面端工程.md 0.6
      验证: 旧页面逐项迁移到新路由，接口联通、权限按钮正确、旧 mock 数据替换为新 API；迁移矩阵全部打勾
      证据:

- [ ] 7.2 服务端旧逻辑全量迁移
      现状: 旧 `taobaoTopClient.js`、`aiMarketAnalysis.js`、`mainImagePromptExpansion.js`、`arkImageGeneration.js`、账号/部门/店铺/平台/菜单/角色等管理逻辑仍留在旧服务
      依据: tasks.md「历史代码迁移与功能收口」
      验证: 旧逻辑按模块迁移或重构成 NestJS 服务/Worker 子任务；同输入行为一致或按新方案明确调整，模块迁移矩阵全部完成
      证据:

- [ ] 7.3 旧表字段语义覆盖核对（不迁移数据）
      现状: 旧 `sys_user`、`product_snapshot`、`market_analysis_run` 等表仅作字段参考；新 schema 从 0 建
      依据: design.md「三、数据库全景」、tasks.md「历史代码迁移与功能收口」
      验证: 新 Prisma schema 与旧表字段覆盖核对表完成；不导入任何旧库数据
      证据:

- [ ] 7.4 本地资产与文件迁移
      现状: 旧 `app/public/generated/product-sets`、视频、店铺 Logo、平台图片等本地资产生成物未纳入新资产体系
      依据: design.md「八、图片与文件资产」、phase-5-资产与OSS.md
      验证: 需要长期保留的资产迁移到 OSS/新资产记录，其余按清理规则收口；迁移过程幂等可校验
      证据:

- [ ] 7.5 配置、Python 运行时与桌面端收口
      现状: 旧环境变量、`skills/` Python 依赖、RPA 采集工具、内置 Python 环境未统一收口
      依据: tasks.md「历史代码迁移与功能收口」、phase-3-RPA-Agent.md 3.5
      验证: 新 backend `.env` 逐项校验；内置 Python 在无系统 Python 的机器上可复现；迁移后的 skills 可由 Agent 调用
      证据:

- [ ] 7.6 旧服务下线与切换
      现状: 旧 `app/server/index.js`、`app/server/apiHandler.js`、`backend/server.js` 等服务与端口尚未停止
      依据: tasks.md「历史代码迁移与功能收口」、phase-6-打包更新与部署.md 6.4
      验证: 新服务部署后旧服务停止，域名/端口切换成功；切回预案演练通过；旧目录可安全归档
      证据:

- [ ] 7.7 清理旧应用依赖与运行目录
      现状: 旧 `app/package.json`、`app/package-lock.json`、旧 `node_modules`、旧 Python 环境未纳入收口
      依据: tasks.md「历史代码迁移与功能收口」、phase-0-桌面端工程.md 0.7
      验证: 新 workspace 只包含 frontend/backend/desktop；旧 app 依赖与本地运行目录按归档规则清理，根级 `pnpm install --frozen-lockfile` 与 `check-env` 不受影响
      证据:

- [ ] 7.8 关闭旧执行入口并完成单一实现收口
      现状: 旧 `market-analysis-report`、旧报告/生图脚本和旧服务入口仍可能被人工直接调用
      依据: tasks.md「历史代码迁移与功能收口」、design.md「多供应商配置实例与后台切换」
      验证: 旧 skill 仅保留迁移参考；正式任务只调用新 backend；旧 `app/server`、`backend/server.js`、旧报告/生图入口停止服务或归档；ProviderProfile、StorageDriver、SQLite 清理配置只有新方案一套事实源
      证据:
