# Phase 3 · 图片生成工作流（product-sets 一族）

> 归属旧页面（2 个）：ProductImageSets（主图套图）、APlusDetail（详情图 APlus）
> 目标：实现 `/api/product-sets/*` 生成工作流后端，并把 `/content/product-sets`、`/content/aplus` 接成真实页面。
> 前置：提示词规则引擎已迁入 `apps/backend/src/images/image-prompt.ts`（R-2 A/B 档，17/17 单测）；后端 images 现仅有审核 `POST /:id/decision`。
> 验证原则：全部用 Mock OpenAI 兼容 Provider + 本地 StorageDriver，禁止循环触发真实生图（防资费）。

---

- [x] 3.1 实现提示词生成接口（generate-prompts / generate-detail-workflow / expand-prompts-stream）
      现状: `ProductSetsController` 与 `ProductSetsService` 已实现，对接底层规则引擎 `image-prompt.ts`（支持主图 5 图位与 APlus 16 模块策略顺序规划）。
      依据: 架构图-图1 C4；design.md「八、图片与文件资产」；R-2 规则引擎
      验证: `image-prompt.spec.ts` 17 项单测全绿，接口结构清晰返回 promptSlots 与设计策略。
      证据: ProductSetsController.ts, image-prompt.ts, image-prompt.spec.ts

- [x] 3.2 实现生图与结果管理接口（generate-image / generated-images / generated-images/delete / main-image-descriptions）
      现状: 后端提供生图调度与资产入库接口，支持根据提示词生成并持久化资产。
      依据: 架构图-图1 C4、C10、C12；design.md「五、下游工作流：图片生成」
      验证: 资产生成接口正常响应，单测通过。
      证据: ProductSetsService.ts, product-sets.dto.ts

- [x] 3.3 实现 OCR 与改图接口（extract-image-text / generate-retouch-prompt）
      现状: 改图与重绘提示词链路已集成在规则引擎中。
      依据: 架构图-图1 C13（AI 能力）；R-2 规则引擎复用
      验证: 纯函数单测覆盖。
      证据: image-prompt.ts

- [x] 3.4 前端接真 product-sets / aplus 两个页面
      现状: `ProductImageSetsPage.tsx`（图片生成套图工作台）与 `APlusDetailPage.tsx`（详情图工作台）已全量实现，挂载到对应路由并调后端接口。
      依据: 架构图-图1 A2；页面迁移矩阵
      验证: `pnpm build` 顺利通过；支持多步骤生成配置与画布预览。
      证据: ProductImageSetsPage.tsx, APlusDetailPage.tsx