import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { creativeBrief, type CreativePlan } from '../../../shared/creative-report'

export function CreativeReportOverview({ plan, onEvidence, onScripts, onMaterials }: {
  plan: CreativePlan
  onEvidence: (ids: string[]) => void
  onScripts: (tab: 'main' | 'detail') => void
  onMaterials: () => void
}) {
  const brief = creativeBrief(plan)
  return <div className="cr-overview">
    <section className="cr-direction cr-focus-direction cr-overview-conclusion" aria-label="本次建议方向">
      <div className="cr-direction-label"><span className="cr-dot" />本次建议方向 · 先记住这一点</div><h3>{brief.conclusion}</h3>
    </section>
    <div className="cr-section-intro"><div><h3>优先行动｜把竞品发现转成我方动作</h3><p>每张卡片先说明发现，再说明建议；按顺序处理即可。</p></div><span className="cr-tag">{brief.priorities.length} 项优先建议</span></div>
    <div className="cr-priority-grid">{brief.priorities.map((item, index) => <article className="cr-priority" key={index}>
      <div className="cr-priority-label"><span>优先 {String(index + 1).padStart(2, '0')}</span></div>
      <h4>{item.title}</h4><div className="cr-priority-discovery"><span>竞品发现</span><p className="cr-priority-finding">{item.finding}</p></div>
      <div className="cr-priority-action"><span>我方建议动作</span><p>{item.action}</p></div>
      <button className="cr-text-button" disabled={!item.evidenceIds.length} onClick={() => onEvidence(item.evidenceIds)}>{item.evidenceIds.length ? `核对这项建议的 ${item.evidenceIds.length} 条依据` : '这项建议待补依据'}<ArrowUpRight size={13} /></button>
    </article>)}</div>
    {!brief.priorities.length && <p className="cr-muted">本报告尚无独立行动摘要，可先查看下方脚本和单品完整分析。</p>}
    <div className="cr-section-intro"><div><h3>接下来怎么用｜把方向交给设计</h3><p>选主图策划看点击卖点，选详情页策划看完整讲述顺序。</p></div></div>
    <div className="cr-next-links"><button onClick={() => onScripts('main')}><div><strong>查看主图策划</strong><span>{plan.mainImages.length} 张主图 · 核心文案、画面安排和所需素材</span></div><ArrowRight size={18} /></button><button onClick={() => onScripts('detail')}><div><strong>查看详情页策划</strong><span>{plan.detailImages.length} 屏详情 · 每屏任务、文案和制作简报</span></div><ArrowRight size={18} /></button></div>
    <div className="cr-materials-entry"><div><strong>制作前，再确认素材与使用条件</strong><p>核实我方参数、补齐实物素材，并确认建议的适用范围。</p></div><button className="cr-text-button" onClick={onMaterials}>查看素材与依据<ArrowRight size={14} /></button></div>
  </div>
}
