# 2026-10-20 报告生成模板接入

「市场 → 竞品分析 → 分析报告」中的「生成报告」现在使用 `ecommerce-analysis-report-generator`，逐商品生成八模块报告。已有报告点「重新生成」后更新；失败时保留旧报告。

## 使用方法

1. 完成采集，确认「查看采集数据」有商品。
2. 在报告列表点击「生成报告」，保持页面打开，等待商品进度完成。
3. 点击「查看报告」，阅读每件商品的八个模块和证据。可展开图片 OCR、评价情感和结论来源。
4. 通过「导出 Markdown」或「导出 JSON」保存完整报告。文件写入应用数据目录下的 `ecommerce/users/<userId>/reports/<reportNo>/`。JSON 包含结构化证据和解析结果。

八个模块依次是：数据源可用性概览、商品标题分析、商品核心卖点、使用人群画像、购买人群画像、产品使用场景、用户诉求及痛点、分析局限与建议。价格带由实际价格计算，作为批次附加统计。

## 数据与模型

- 报告读取客户端本机 SQLite 的 ProductSnapshot、ProductSkuSnapshot、ProductReviewSnapshot、ProductQaSnapshot；问答包含回答。登录认证仍由后端负责。
- 图片优先从采集记录 `rawJson.sourceData` 指向的本机导出目录读取实际字节；只允许应用数据目录内的图片。远程图片 URL 使用当前配置的视觉模型读取。
- 每商品最多提交 2 张主图、2 张详情图、1 张 SKU 图；单张最多 10 MiB，总图片请求约 28 MiB。图片数量、读取失败与选样限制会进入报告。
- 评价去除空内容及默认好评后，均匀抽取最多 120 条；问答最多 80 条，每条文本最多 1200 字符。页面显示输入样本数和解析结果。
- 先由视觉模型单独解析图片与 OCR，再将解析结果和文本资料交给文本模型生成完整报告。文本与视觉模型沿用应用已有个人/默认供应商配置，不在 Skill 内保存密钥。支持 OpenAI 与 Anthropic 兼容协议，Anthropic 本机图使用 base64 source。
- 视觉请求失败或无法返回有效解析时去掉图片输入，改用文本资料，报告标明图片不可用；不能把图片文件名当成图像内容。
- 同类评价多条不增加来源种类。结构化证据按实际来源类型计算「单源推断 / 双源印证 / 多源印证」。未知来源 ID、无效 JSON、缺少八模块的结果不会保存成功。
- 供应商临时错误、限流或超时仅重试失败阶段一次，已完成的图片解析会复用。最多同时分析两件商品；全部完成后事务更新报告及附表，避免只保存一部分。重新生成使用原采集批次，并产生新报告编号，避免复用旧导出文件。

## 资源位置与来源

- `skills/ecommerce-analysis-report-generator/SKILL.md`
- `skills/ecommerce-analysis-report-generator/references/upstream-parsing.md`
- `skills/ecommerce-analysis-report-generator/references/report_template.md`
- 主流程：`apps/desktop/src/worker/report-skill-pipeline.ts`
- 入口与数据库保存：`apps/desktop/src/worker/report-capability.ts`
- 页面：`ReportsListPage.tsx`、`AnalysisReportViewPage.tsx`、`SkillProductReports.tsx`

开发版从仓库 skills 目录读取；安装包通过 electron-builder extraResources 携带同一份资源。每份报告保存 reportVersion 与 templateHash，可核对模板版本。

来源：用户提供的 `report-generation-skills-20261020.zip`。
ZIP SHA-256：`ae27241f4242be433b74be5b2a7a773f8a5f0e57cff48ffa3002acd9dd09283a`。
`skills/competitor-analysis` 一并保留为独立的可选规则分析工具；其中的 MySQL 脚本不用于此按钮，避免与客户端快照表结构混用。现有采集导入流程继续使用项目原有 mysql-import。

## 验证

相关 Vitest 覆盖批次选择、旧报告复用与失败保护、实际本机图片字节、问答答案、来源校验、视觉降级、完整模块、导出、Anthropic 图片格式。所有自动化生成用隔离测试数据库及模拟模型，不修改用户数据。

## 主图与详情页策划工作台

分析报告列表展示批次数、当前页主图/详情脚本数、采集数据量与策划状态。已有报告通过「查看出图方案」进入新工作台；尚未生成策划的批次可生成或更新报告。

- 详情分为「主图脚本」「详情页脚本」「竞品依据」「完整分析」。每组默认5张主图与8屏详情，每个任务包含文案、构图、来源、待补素材和画面简报，支持单张或整组复制。
- 来源页按商品保留标题、评价、问答和已完成的图片观察，可检索来源、回看本机主图与数据局限。
- `report.generate` 在八模块分析后增加独立的内容策划步骤，读取 `references/creative-brief-template.md`；返回5+8结构、校验证据ID和必需字段后才在事务中替换旧报告。暂时供应商错误最多重试失败阶段一次。
- 对大批次均匀抽取最多20件商品，评价选样优先保留已有的负面和混合解析，其余均匀选取；选样数量和文本截断限制写入risks。完整单品分析仍保留在productReports中。
- 结构化方案保存于 `AnalysisRun.reportJson.creativePlan`，含版本、数据量、脚本、证据、素材需求及研究正文。旧报告字段保留；原有采集表和数据库连接配置不变。
- 新导出包含完整策划及证据，导出缓存路径带reportHash，避免更新策划后仍读取旧文件。页面支持Markdown、HTML、JSON文件导出；智能问答上下文也包含主图与详情脚本。
- 本机猫粮、冲锋衣两份既有策划已按之前交付的研究内容分别导入对应报告，不通过运行时硬编码品类样例来替代新数据。导入前已备份本机数据库。

相关新增文件：`shared/creative-report.ts`、`worker/creative-report.ts`、`renderer/src/components/CreativeReportView.tsx`、`renderer/src/styles/creative-report.css`。
