# Phase 3 · 图片生成工作流（product-sets 一族）

> 归属旧页面（2 个）：ProductImageSets（主图套图）、APlusDetail（详情图 APlus）
> 目标：实现 `/api/product-sets/*` 生成工作流后端，并把 `/content/product-sets`、`/content/aplus` 接成真实页面。
> 前置：提示词规则引擎已迁入 `apps/backend/src/images/image-prompt.ts`（R-2 A/B 档，17/17 单测）；后端 images 现仅有审核 `POST /:id/decision`。
> 验证原则：全部用 Mock OpenAI 兼容 Provider + 本地 StorageDriver，禁止循环触发真实生图（防资费）。

---

- [ ] 3.1 实现提示词生成接口（generate-prompts / generate-detail-workflow / expand-prompts-stream）
      现状: 旧 `/api/product-sets/generate-prompts`（settings+baseText+reportText+information+image+promptSlots）、`generate-detail-workflow`（APlus 模块顺序、detailStrategyPlan）、`expand-prompts-stream`（SSE 流式 thinking/content/done/error）；新后端 `image-prompt.ts` 已含 5 图位/16 模块/加载器/纯函数但未接 HTTP。
      依据: 架构图-图1 C4（生图）；design.md「八、图片与文件资产」；R-2 规则引擎
      验证: `pnpm --filter backend test image-prompt`（既有 17 单测全绿）+ 新增 controller 单测（传入 settings/reportText 断言输出的 promptSlots/模块顺序）➔ 预期: 接口返回结构化提示词，SSE 事件含 id/type/data。
      证据: (执行阶段回填)

- [ ] 3.2 实现生图与结果管理接口（generate-image / generated-images / generated-images/delete / main-image-descriptions）
      现状: 旧接口 `generate-image`（调 AI 生图返回 dataUrl/url）、`generated-images`（入库生成主图）、`generated-images/delete`、`main-image-descriptions`（读报告卖点做生图输入）；新后端 `images` 只有审核决策，缺 Job(image-gen) 生成链路 + `GeneratedAsset` 落库 + StorageDriver 写入。
      依据: 架构图-图1 C4、C10、C12；design.md「五、下游工作流：图片生成」「八、StorageDriver」；旧表 `generated_main_image → GeneratedAsset`
      验证: 用 MockAiProvider 生成 + 本地 `LocalStorageDriver`，`pnpm --filter backend test`（生图服务 + AiUsageLog 落审计）+ `curl` 生成→入库→`GET /api/assets/:id` 可读 ➔ 预期: 生成成功写入 GeneratedAsset 且资产可读、审计日志有记录。
      证据: (执行阶段回填)

- [ ] 3.3 实现 OCR 与改图接口（extract-image-text / generate-retouch-prompt）
      现状: 旧 `extract-image-text`（OCR 提取图片文字）、`generate-retouch-prompt`（根据用户改图方向生成新提示词）后再调 generate-image；新后端缺失。
      依据: 架构图-图1 C13（AI 能力）；R-2 规则引擎复用
      验证: 用 Mock OCR/提示词单测覆盖纯函数，`pnpm --filter backend test` 通过；改图链路走 generate-image（Mock）➔ 预期: OCR 返回文本、改图提示词正确、可再次生图。
      证据: (执行阶段回填)

- [ ] 3.4 前端接真 product-sets / aplus 两个页面
      现状: `apps/desktop/src/renderer/src/main.tsx` 中 `/content/product-sets`（图片生成）、`/content/aplus`（详情图）为 StubPage；旧 ProductImageSets/APlusDetail 为复杂工作台（左参数/中画布/结果队列/下载）。
      依据: 架构图-图1 A2；页面迁移矩阵
      验证: `pnpm --filter frontend build` + `pnpm --filter frontend test`（工作台渲染）+ 浏览器用 Mock 数据走完「选报告→生成提示词→生图→入库→预览下载」➔ 预期: 两页可完整走通工作流，无"模块待接入"。
      证据: (执行阶段回填)