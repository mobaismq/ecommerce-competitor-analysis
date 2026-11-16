import { reportChartsMarkdown, type ReportChartProduct } from './report-charts'
import type { ProductSkillReport } from './report-skill'

export const CREATIVE_REPORT_VERSION = 'creative-report-20261020-v1'
export interface CreativeEvidence {
  id: string
  productId: string
  kind: 'title' | 'review' | 'qa' | 'main_image' | 'detail_image' | 'sku_image'
  label: string
  text: string
}
export interface CreativeScript {
  order: number
  purpose: string
  headline: string
  visual: string
  evidenceIds: string[]
  requirements: string[]
  prompt: string
}
export interface CreativePriority {
  title: string
  finding: string
  action: string
  evidenceIds: string[]
}
export interface CreativeBrief {
  conclusion: string
  priorities: CreativePriority[]
}
export interface CreativePlan {
  version: string
  title: string
  direction: string
  /** 阅读摘要；旧报告自动回退到已有洞察。 */
  brief?: CreativeBrief
  audience: string
  mainImages: CreativeScript[]
  detailImages: CreativeScript[]
  insights: Array<{ title: string; finding: string; action: string; evidenceIds: string[] }>
  risks: string[]
  missingMaterials: string[]
  evidence: CreativeEvidence[]
  dataCounts: { products: number; reviews: number; images: number; qa: number }
  researchMarkdown?: string
  generatedAt: string
  model: string
}

/** 兼容已生成报告，不触发模型请求、不补造结论。 */
export function creativeBrief(plan: CreativePlan): CreativeBrief {
  return plan.brief ?? { conclusion: plan.direction, priorities: plan.insights.slice(0, 3) }
}

export const REPORT_PRESENTATION_VERSION = 'structure-v7-product-sources'

/** Collapse formatting-only duplicates; do not infer equivalence or discard production constraints. */
export function creativeScriptInstructions(item: Pick<CreativeScript, 'visual' | 'prompt'>): string[] {
  const visual = item.visual.trim(), prompt = item.prompt.trim()
  if (!visual) return prompt ? [prompt] : []
  if (!prompt) return [visual]
  const comparable = (text: string) => text.normalize('NFKC').replace(/[\s，,。；;：:、]/g, '')
  const visualText = comparable(visual), promptText = comparable(prompt)
  if (visualText === promptText) return [visual]
  return [visual, prompt]
}

export function creativeScriptText(item: CreativeScript, plan: CreativePlan): string {
  const [visual, supplement] = creativeScriptInstructions(item)
  return [
    `${String(item.order).padStart(2, '0')}. ${item.purpose}`,
    `文案草案：${item.headline}`,
    `画面与制作说明：${visual || '待补充'}`,
    ...(supplement ? [`补充制作说明：${supplement}`] : []),
    `所需素材与使用条件：${item.requirements.join('；') || '核实我方商品与素材适用性'}`,
    `依据：${item.evidenceIds.map((id) => {
      const source = plan.evidence.find((entry) => entry.id === id)
      return source ? `${source.label}（商品 ${source.productId}）：${source.text}` : id
    }).join('\n') || '待补证据'}`,
  ].join('\n')
}

export function creativePlanMarkdown(plan: CreativePlan, research = plan.researchMarkdown || '', charts: { products?: ReportChartProduct[]; reports?: ProductSkillReport[] } = {}): string {
  const brief = creativeBrief(plan)
  const sourceNumbers = new Map(plan.evidence.map((item, index) => [item.id, index + 1]))
  const refs = (ids: string[]) => ids.map((id) => sourceNumbers.has(id) ? `[${sourceNumbers.get(id)}]` : id).join('、') || '待补证据'
  const scripts = (title: string, items: CreativeScript[]) => [
    `## ${title}`,
    '每张图一份完整制作方案，包含任务、文案、画面说明、素材要求与依据。',
    ...items.map((item) => {
      const [visual, supplement] = creativeScriptInstructions(item)
      return [
      `### ${String(item.order).padStart(2, '0')} · ${item.headline}`,
      `**本图任务：** ${item.purpose}`,
      `**画面与制作说明：** ${visual || '待补充'}`,
      ...(supplement ? [`**补充制作说明：** ${supplement}`] : []),
      `**使用前补齐：** ${item.requirements.join('；') || '核实我方商品与素材适用性'}`,
      `依据：${refs(item.evidenceIds)}，原文见末尾证据索引。`,
    ].join('\n\n') }),
  ].join('\n\n')
  return [ `# ${plan.title}`,
    '用竞品资料确定我方卖点，再整理成可交给设计师的主图与详情页脚本。交付：建议 + 文字脚本 + 依据。',
    `数据基础：${plan.dataCounts.products} 件竞品 · ${plan.dataCounts.reviews} 条采集评价。图片与问答的可用性见素材与依据。`,
    '## 01 结论与行动', '运营先看：竞品有哪些值得参考的信号，我方应优先做什么？',
    '### 本次建议方向', `**${brief.conclusion}**`,
    '### 优先行动｜把竞品发现转成我方动作',
    ...brief.priorities.map((item, index) => `#### ${index + 1}. ${item.title}\n\n**竞品发现：** ${item.finding}\n\n**我方建议动作：${item.action}**\n\n核对依据：${refs(item.evidenceIds)}。`),
    reportChartsMarkdown(charts.products, charts.reports),
    `目标使用者 / 购买者：${plan.audience}`,
    scripts('04 主图策划｜主图内容脚本', plan.mainImages), scripts('05 详情页策划｜详情页内容脚本', plan.detailImages),
    '## 06 素材与依据', '制作前核对：还要准备哪些我方素材，建议又来自哪些竞品资料？',
    '### 制作准备｜待补的我方素材', ...plan.missingMaterials.map((item) => `- ${item}`),
    '### 数据局限与使用边界', '以下是竞品研究和待验证的内容方向；我方卖点、参数和适用范围需以实际资料为准。', ...plan.risks.map((item) => `- ${item}`),
    '### 竞品发现汇总', ...plan.insights.map((item) => `#### ${item.title}\n\n${item.finding}\n\n我方建议动作：${item.action}\n\n依据：${refs(item.evidenceIds)}。`),
    '### 证据原文｜核对建议具体来自哪里', ...plan.evidence.map((item, index) => `#### [${index + 1}] ${item.label} · 商品 ${item.productId}\n\n${item.text}\n\n来源 ID：${item.id}`),
    ...(research ? ['## 07 单品完整分析', '需要深读时：每件竞品的卖点、人群、场景和痛点，是怎样分析出来的？', research] : []),
  ].join('\n\n')
}
