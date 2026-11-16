import { creativeBrief, creativeScriptInstructions, type CreativePlan } from '../../../shared/creative-report'
import type { SuiteProduct } from './AIReportSelector'

export type ReportGenerationKind = 'main' | 'detail'
export interface ReportGenerationHandoff {
  kind: ReportGenerationKind
  report: SuiteProduct
  text: string
  headlines: string[]
}

export const REPORT_GENERATION_ROUTES: Record<ReportGenerationKind, string> = { main: '/product-sets', detail: '/aplus' }

/** Carry the selected production plan, including its conditions, without copying the research appendix. */
export function createReportGenerationHandoff(plan: CreativePlan, kind: ReportGenerationKind, reportId: string, keyword: string): ReportGenerationHandoff {
  const items = kind === 'main' ? plan.mainImages : plan.detailImages
  const label = kind === 'main' ? '主图' : '详情页'
  const text = [
    `【${label}制作方案 · ${keyword || plan.title}】`,
    '请以我方上传的商品原图及已确认资料为准，参考以下内容制作；竞品的卖点、参数和用户体验需核实后才能用于我方商品。',
    `策划方向：${creativeBrief(plan).conclusion}`,
    `参考人群：${plan.audience}`,
    ...items.map((item) => {
      const [visual, supplement] = creativeScriptInstructions(item)
      return [
        `【${String(item.order).padStart(2, '0')} · ${item.purpose}】`,
        `文案草案：${item.headline}`,
        `画面与制作说明：${visual || '待补充'}`,
        ...(supplement ? [`补充制作说明：${supplement}`] : []),
        `所需素材与使用条件：${item.requirements.join('；') || '核实我方商品与素材适用性'}`,
      ].join('\n')
    }),
    ...(plan.missingMaterials.length ? [`【待补的我方素材】\n${plan.missingMaterials.join('\n')}`] : []),
    ...(plan.risks.length ? [`【使用边界】\n${plan.risks.join('\n')}`] : []),
  ].join('\n\n')
  return {
    kind,
    report: { value: reportId, reportId, label: keyword || plan.title, keyword, count: plan.dataCounts.products },
    text,
    headlines: items.map((item) => item.headline),
  }
}

export function readReportGenerationHandoff(state: unknown, kind: ReportGenerationKind): ReportGenerationHandoff | null {
  if (!state || typeof state !== 'object' || !('reportGeneration' in state)) return null
  const value = state.reportGeneration
  if (!value || typeof value !== 'object' || !('kind' in value) || value.kind !== kind) return null
  if (!('text' in value) || typeof value.text !== 'string' || !value.text.trim()) return null
  if (!('headlines' in value) || !Array.isArray(value.headlines) || !value.headlines.every((item) => typeof item === 'string')) return null
  if (!('report' in value) || !value.report || typeof value.report !== 'object') return null
  const report = value.report
  if (!('value' in report) || typeof report.value !== 'string' || !report.value.trim()) return null
  if (!('label' in report) || typeof report.label !== 'string' || !('count' in report) || typeof report.count !== 'number') return null
  return value as ReportGenerationHandoff
}
