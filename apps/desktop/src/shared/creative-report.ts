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
export interface CreativePlan {
  version: string
  title: string
  direction: string
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

export function creativePlanMarkdown(plan: CreativePlan): string {
  const row = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, '；')
  const scripts = (title: string, items: CreativeScript[]) => [
    `## ${title}`, '| 图序 | 任务 | 文案草案 | 画面脚本 | 依据 | 待补材料 |', '|---|---|---|---|---|---|',
    ...items.map((item) => `| ${item.order} | ${row(item.purpose)} | ${row(item.headline)} | ${row(item.visual)} | ${row(item.evidenceIds.join('、'))} | ${row(item.requirements.join('；'))} |`),
    '### 可交付的画面简报', ...items.map((item) => `- ${item.order}. ${item.prompt}`),
  ].join('\n')
  return [ `# ${plan.title}`, plan.direction, `目标使用者 / 购买者：${plan.audience}`,
    `参考数据：${plan.dataCounts.products} 件商品、${plan.dataCounts.reviews} 条评价、${plan.dataCounts.images} 条图片记录、${plan.dataCounts.qa} 条问答。`,
    '文案为策划草案，方括号为待核实字段；我方功能与参数须以真实商品资料为准。',
    scripts('主图内容脚本', plan.mainImages), scripts('详情页内容脚本', plan.detailImages),
    '## 竞品发现与内容动作', ...plan.insights.map((item) => `- ${item.title}：${item.finding}\n  内容动作：${item.action}；依据：${item.evidenceIds.join('、')}`),
    '## 待补素材', ...plan.missingMaterials.map((item) => `- ${item}`), '## 数据局限', ...plan.risks.map((item) => `- ${item}`),
    '## 证据索引', ...plan.evidence.map((item) => `- ${item.id}｜${item.label}｜商品 ${item.productId}：${item.text}`),
    ...(plan.researchMarkdown ? ['## 完整研究报告', plan.researchMarkdown] : []),
  ].join('\n\n')
}
