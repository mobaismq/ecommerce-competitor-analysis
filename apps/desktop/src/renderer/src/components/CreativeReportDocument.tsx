import { Fragment, useId, useState, type ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, ChevronDown, ClipboardCheck, Copy, FileSearch, FileText, FolderOpen, Image as ImageIcon, Layers, Lightbulb, MessageSquareText, Quote, Search, ShieldCheck, Target, ThumbsUp, type LucideIcon } from 'lucide-react'
import { creativeBrief, creativeScriptInstructions, creativeScriptText, type CreativePlan, type CreativePriority, type CreativeScript } from '../../../shared/creative-report'
import type { ProductSkillReport } from '../../../shared/report-skill'
import { ReportMarkdown } from './SkillProductReports'
import { ImageAssetPanel, imageCountText } from './ImageAssetList'
import type { ReportGenerationKind } from './report-generation-handoff'
import { CompetitorPoolChart, PositiveSellingPointChart, type ReportChartImage } from './CompetitorReportCharts'
import type { ReportChartProduct } from '../../../shared/report-charts'

export const DOCUMENT_SECTIONS = [
  { id: 'overview', title: '重点与行动', icon: Target },
  { id: 'competitors', title: '竞品池 Top 10', icon: BarChart3 },
  { id: 'positive', title: '好评卖点 Top 3', icon: ThumbsUp },
  { id: 'main', title: '主图方案', icon: ImageIcon },
  { id: 'detail', title: '详情页方案', icon: Layers },
  { id: 'sources', title: '制作准备与依据', icon: ClipboardCheck },
  { id: 'research', title: '竞品研究资料', icon: BookOpen },
] as const
export type DocumentSection = typeof DOCUMENT_SECTIONS[number]['id']

export type ReportProduct = ReportChartProduct

function DocumentSectionBlock({ id, children, note, meta }: { id: DocumentSection; children: ReactNode; note?: string; meta?: string }) {
  const index = DOCUMENT_SECTIONS.findIndex((item) => item.id === id)
  const section = DOCUMENT_SECTIONS[index]
  const Icon = section.icon
  return <section id={`creative-document-${id}`} className="cr-document-section" data-report-section={id} data-report-module={id} tabIndex={-1} aria-labelledby={`creative-document-heading-${id}`}>
    <header className="cr-document-module-header">
      <span className="cr-document-module-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <h2 id={`creative-document-heading-${id}`}><Icon size={18} aria-hidden="true" />{section.title}</h2>
      {meta && <span className="cr-document-module-meta">{meta}</span>}
    </header>
    <div className="cr-document-module-body">
      {note && <p className="cr-document-note cr-document-module-note">{note}</p>}
      {children}
    </div>
  </section>
}

/** Keep the reading outline visible while mounting long source text only on demand. */
function ReportDisclosure({ title, meta, children, open, onToggle, defaultOpen = false, icon: Icon = FileText }: {
  title: string; meta?: string; children: ReactNode; open?: boolean; onToggle?: () => void; defaultOpen?: boolean; icon?: LucideIcon
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const contentId = useId()
  const expanded = open ?? internalOpen
  return <div className={`cr-focus-disclosure${expanded ? ' is-open' : ''}`}>
    <button type="button" className="cr-focus-disclosure-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={onToggle ?? (() => setInternalOpen((value) => !value))}>
      <span className="cr-focus-disclosure-icon" aria-hidden="true"><Icon size={16} /></span>
      <span className="cr-focus-disclosure-label"><strong title={title}>{title}</strong>{meta && <small>{meta}</small>}</span><ChevronDown size={15} aria-hidden="true" />
    </button>
    {expanded && <div id={contentId} className="cr-focus-disclosure-body">{children}</div>}
  </div>
}

function PriorityAction({ item, index, onEvidence }: { item: CreativePriority; index: number; onEvidence: (ids: string[]) => void }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  return <article className="cr-focus-priority">
    <div className="cr-focus-priority-label"><span>{String(index + 1).padStart(2, '0')}</span>优先行动</div>
    <h3>{item.title}</h3>
    <button className="cr-document-text-button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((value) => !value)}>{expanded ? '收起详情' : '行动与依据'}<ChevronDown size={12} /></button>
    {expanded && <div id={contentId} className="cr-focus-reason"><p className="cr-focus-action">{item.action}</p><p>{item.finding}</p><button className="cr-document-text-button" disabled={!item.evidenceIds.length} onClick={() => onEvidence(item.evidenceIds)}>{item.evidenceIds.length ? `核对 ${item.evidenceIds.length} 条原文` : '待补依据'}<ArrowUpRight size={12} /></button></div>}
  </article>
}

function ScriptTable({ items, plan, onCopy, onEvidence, onGenerate, kind }: {
  items: CreativeScript[]; plan: CreativePlan; onCopy: (text: string) => void; onEvidence: (ids: string[]) => void; onGenerate: (kind: ReportGenerationKind) => void; kind: ReportGenerationKind
}) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const idPrefix = useId()
  const allExpanded = items.length > 0 && expandedRows.size === items.length
  const toggleRow = (order: number) => setExpandedRows((previous) => {
    const next = new Set(previous)
    if (next.has(order)) next.delete(order)
    else next.add(order)
    return next
  })
  return <>
    <div className="cr-document-section-tools"><span>点「方案」看完整说明</span><div className="cr-focus-table-tools">
      <button className="cr-document-text-button" onClick={() => setExpandedRows(allExpanded ? new Set() : new Set(items.map((item) => item.order)))}>{allExpanded ? '收起全部细节' : '展开全部细节'}</button>
      <button className="cr-document-text-button" onClick={() => onCopy(items.map((item) => creativeScriptText(item, plan)).join('\n\n'))}><Copy size={13} />复制全部{kind === 'main' ? '主图' : '详情'}方案</button>
      <button className="cr-document-generate-button" disabled={!items.length} onClick={() => onGenerate(kind)}>去生成{kind === 'main' ? '主图' : '详情图'}<ArrowUpRight size={14} /></button>
    </div></div>
    <div className="cr-document-table-scroll cr-focus-script-frame"><table className="cr-document-table cr-focus-script-table">
      <caption className="sr-only">{kind === 'main' ? '主图' : '详情页'}内容方案</caption>
      <thead><tr><th scope="col">{kind === 'main' ? '图序' : '屏序'}</th><th scope="col" className="cr-focus-copy-heading">核心文案</th><th scope="col">画面方向</th><th scope="col">操作</th></tr></thead>
      <tbody>{items.map((item) => {
        const expanded = expandedRows.has(item.order)
        const [visual, supplement] = creativeScriptInstructions(item)
        const detailId = `${idPrefix}-${item.order}`
        return <Fragment key={item.order}>
          <tr className={`cr-focus-script-row${expanded ? ' is-open' : ''}`}>
            <th scope="row" title={item.purpose}><span className="cr-focus-order">{String(item.order).padStart(2, '0')}</span></th>
            <td className="cr-focus-copy-cell"><p className="cr-focus-headline"><strong>{item.headline}</strong></p></td>
            <td><p className="cr-focus-visual">{visual || '待补充画面说明'}</p></td>
            <td><div className="cr-focus-row-controls"><button className="cr-focus-detail-button" aria-label={`${expanded ? '收起' : '展开'}${kind === 'main' ? '主图' : '详情'} ${item.order} 制作详情`} aria-expanded={expanded} aria-controls={detailId} onClick={() => toggleRow(item.order)}>{expanded ? '收起' : '方案'}<ChevronDown size={12} /></button><button className="cr-document-text-button" title="复制完整方案" aria-label={`复制${kind === 'main' ? '主图' : '详情'} ${item.order} 完整方案`} onClick={() => onCopy(creativeScriptText(item, plan))}><Copy size={13} /></button></div></td>
          </tr>
          {expanded && <tr className="cr-focus-script-detail"><td colSpan={4}><div id={detailId} className="cr-focus-script-detail-body"><p className="cr-focus-task-detail"><strong>本图目标：</strong>{item.purpose}</p><div className={`cr-focus-production${supplement ? '' : ' single'}`}>
            <div><h4>制作前准备 · {item.requirements.length || 1} 项</h4><ul>{item.requirements.length ? item.requirements.map((entry, index) => <li key={index}>{entry}</li>) : <li>核实我方商品与素材适用性</li>}</ul></div>
            {supplement && <div><h4>补充制作说明</h4><p>{supplement}</p></div>}
          </div><div className="cr-focus-evidence-actions"><button className="cr-document-text-button" disabled={!item.evidenceIds.length} onClick={() => onEvidence(item.evidenceIds)}>{item.evidenceIds.length ? `核对 ${item.evidenceIds.length} 条依据` : '待补依据'}<ArrowUpRight size={12} /></button></div></div></td></tr>}
        </Fragment>
      })}</tbody>
    </table></div>
  </>
}

export function CreativeReportDocument({ plan, keyword, productReports = [], products, totalProducts, productsLoading, productsError, onRetryProducts, onCopy, onNavigate, onGenerate, referenceImages = [], reportId }: {
  plan: CreativePlan; keyword: string; productReports?: ProductSkillReport[]; products: ReportProduct[]; totalProducts: number
  productsLoading: boolean; productsError: boolean; onRetryProducts: () => void; onCopy: (text: string) => void
  onNavigate: (section: DocumentSection, target?: 'evidence') => void
  onGenerate: (kind: ReportGenerationKind) => void
  referenceImages?: ReportChartImage[]
  reportId?: string
}) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [allEvidence, setAllEvidence] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const brief = creativeBrief(plan)
  const priorities = brief.priorities.slice(0, 3)
  const sourceNumbers = new Map(plan.evidence.map((item, index) => [item.id, index + 1]))
  const showEvidence = (ids: string[]) => {
    setSelectedIds(ids)
    setQuery('')
    setAllEvidence(true)
    setEvidenceOpen(true)
    onNavigate('sources', 'evidence')
  }
  const evidence = plan.evidence.filter((item) => (!selectedIds.length || selectedIds.includes(item.id)) && `${item.label} ${item.text} ${item.productId}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const reviewItems = productReports.flatMap((report) => report.reviewAnalysis.map((item) => ({ ...item, productId: report.productId })))
  const uniqueSignals = (sentiments: string[]) => {
    const seen = new Set<string>()
    return reviewItems.filter((item) => {
      if (!sentiments.includes(item.sentiment) || !item.quote.trim() || seen.has(item.point)) return false
      seen.add(item.point)
      return true
    }).slice(0, 3)
  }
  const concernSignals = uniqueSignals(['negative', 'mixed'])
  const imageCounts = productReports.reduce((sum, report) => ({ used: sum.used + report.sampleCounts.imagesUsed, available: sum.available + report.sampleCounts.imagesAvailable }), { used: 0, available: 0 })
  const reviewSection = (title: string, items: typeof reviewItems) => <div className="cr-document-review-group"><h3>{title}</h3>{items.map((item, index) => <div className="cr-document-review" key={`${item.productId}-${item.reviewId}-${index}`}><h4>{item.point}</h4><blockquote>“{item.quote}”</blockquote><p className="cr-document-attribution">商品 {item.productId} · {item.reviewId}</p></div>)}</div>

  return <article className="cr-document-paper cr-focus-paper" aria-label="竞品分析报告正文">
    <DocumentSectionBlock id="overview" meta={`${priorities.length} 项优先行动`}>
      <div className="cr-focus-conclusion"><span className="cr-focus-kicker">{keyword || '竞品'} · 本次重点</span><h2>{brief.conclusion}</h2><div className="cr-focus-output"><span>{plan.mainImages.length} 张主图</span><span>{plan.detailImages.length} 屏详情</span></div></div>
      {!!priorities.length && <><div className="cr-focus-section-label"><strong>优先做这 {priorities.length} 件事</strong><span>按顺序交给运营和设计</span></div><div className="cr-focus-priorities">{priorities.map((item, index) => <PriorityAction key={index} item={item} index={index} onEvidence={showEvidence} />)}</div></>}
      <div className="cr-focus-start-links"><button onClick={() => onNavigate('main')}>看主图方案<ArrowRight size={14} /></button><button onClick={() => onNavigate('detail')}>看详情页方案<ArrowRight size={14} /></button></div>
    </DocumentSectionBlock>

    <DocumentSectionBlock id="competitors" meta="本批快照">
      <CompetitorPoolChart products={products} reports={productReports} images={referenceImages} total={totalProducts} loading={productsLoading} error={productsError} onRetry={onRetryProducts} />
    </DocumentSectionBlock>
    <DocumentSectionBlock id="positive" meta="已解析好评">
      <PositiveSellingPointChart reports={productReports} products={products} images={referenceImages} />
    </DocumentSectionBlock>

    <DocumentSectionBlock id="main" meta={`${plan.mainImages.length} 张主图`}>
      <ScriptTable items={plan.mainImages} plan={plan} onCopy={onCopy} onEvidence={showEvidence} onGenerate={onGenerate} kind="main" />
    </DocumentSectionBlock>
    <DocumentSectionBlock id="detail" meta={`${plan.detailImages.length} 屏详情`}>
      <ScriptTable items={plan.detailImages} plan={plan} onCopy={onCopy} onEvidence={showEvidence} onGenerate={onGenerate} kind="detail" />
    </DocumentSectionBlock>

    <DocumentSectionBlock id="sources" meta="素材 · 范围 · 原文" note="制作前核对素材，需要判断来源时再查看原文。">
      <ReportDisclosure title="待补的我方素材" icon={FolderOpen} meta={`${plan.missingMaterials.length} 项`}><ol className="cr-document-list">{plan.missingMaterials.map((item, index) => <li key={index}>{item}</li>)}</ol></ReportDisclosure>
      <ReportDisclosure title="数据范围与使用边界" icon={ShieldCheck} meta={`${plan.risks.length} 项说明`}><p><strong>参考对象：</strong>{plan.audience}</p><p className="cr-document-note">{plan.dataCounts.products} 件竞品 · {plan.dataCounts.reviews} 条评价 · 问答 {plan.dataCounts.qa} 条{productReports.length ? ` · 图片实际解析 ${imageCounts.used}/${imageCounts.available} 张` : ''}</p><ul className="cr-document-list">{plan.risks.map((item, index) => <li key={index}>{item}</li>)}</ul></ReportDisclosure>
      <div id="creative-document-evidence" className="cr-document-evidence-section" tabIndex={-1} aria-label="竞品证据原文">
        <ReportDisclosure title="证据原文" icon={Quote} meta={`${plan.evidence.length} 条，可搜索核对`} open={evidenceOpen} onToggle={() => setEvidenceOpen((value) => !value)}>
          <div className="cr-document-evidence-heading"><span className="cr-document-note">匹配 {evidence.length} 条</span><label className="cr-document-search"><Search size={14} /><input aria-label="搜索证据" placeholder="搜索评价、标题或商品" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
          {!!selectedIds.length && <p className="cr-document-evidence-filter" role="status">已定位所选建议 / 方案的 {evidence.length} 条依据。<button className="cr-document-text-button" onClick={() => setSelectedIds([])}>查看全部证据</button></p>}
          <div className="cr-document-evidence">{(allEvidence ? evidence : evidence.slice(0, 3)).map((item) => <div key={item.id}><p className="cr-document-evidence-label">[{sourceNumbers.get(item.id)}] {item.label} <span>商品 {item.productId}</span></p><p>{item.text}</p></div>)}</div>
          {!evidence.length && <p className="cr-document-note">没有匹配的证据，请调整搜索条件。</p>}
          {!allEvidence && evidence.length > 3 && <button className="cr-document-text-button" onClick={() => setAllEvidence(true)}>展开全部 {evidence.length} 条原文<ArrowUpRight size={12} /></button>}
        </ReportDisclosure>
      </div>
    </DocumentSectionBlock>

    <DocumentSectionBlock id="research" meta={`${totalProducts} 件竞品`} note="供深读与核对，点击需要的资料展开。">
      {!!concernSignals.length && <ReportDisclosure title="顾虑与体验分歧" icon={MessageSquareText} meta={`${concernSignals.length} 条摘录`}>{reviewSection('代表摘录', concernSignals)}</ReportDisclosure>}
      {!!plan.insights.length && <ReportDisclosure title="竞品发现与内容动作" icon={Lightbulb} meta={`${plan.insights.length} 项发现`}>{plan.insights.map((item, index) => <div className="cr-document-prompt" key={index}><h3>{item.title}</h3><p>{item.finding}</p><p className="cr-document-insight-action"><strong>我方动作：{item.action}</strong></p><button className="cr-document-text-button" disabled={!item.evidenceIds.length} onClick={() => showEvidence(item.evidenceIds)}>核对依据<ArrowUpRight size={12} /></button></div>)}</ReportDisclosure>}
      {plan.researchMarkdown ? <ReportDisclosure title="完整研究报告" meta="保留全部研究正文"><ReportMarkdown text={plan.researchMarkdown} /></ReportDisclosure> : productReports.length ? productReports.map((report, index) => <ReportDisclosure key={report.productId} icon={FileSearch} title={`单品分析 ${index + 1} · ${report.title}`} meta={`商品 ${report.productId}`}>
        <p><strong>单品结论：</strong>{report.summary}</p><p className="cr-document-note">图片{imageCountText(report)} · 评价 {report.sampleCounts.reviewsUsed}/{report.sampleCounts.reviewsTotal} 条 · 问答 {report.sampleCounts.qaUsed}/{report.sampleCounts.qaTotal} 条</p>
        <ReportDisclosure title="完整八模块分析"><ReportMarkdown text={report.markdown} />{!!report.limitations.length && <><h4>补充局限</h4><ul className="cr-document-list">{report.limitations.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul></>}</ReportDisclosure>
        <ReportDisclosure title="结论证据、图片与评价解析">
          <h4>结论证据</h4>{report.evidence.map((item, itemIndex) => <p key={itemIndex}>{item.claim}【{item.confidence}】<br />{item.quote}<br /><span className="cr-document-note">来源：{item.sourceIds.join('、')}</span></p>)}
          <h4>图片 OCR 与视觉观察</h4>{report.imageAssets?.length ? <ImageAssetPanel report={report} reportId={reportId} /> : report.imageObservations.length ? report.imageObservations.map((item) => <p key={item.imageId}>{item.imageId}：{item.observation}<br />可见文字：{item.ocr.join('、') || '未识别到文字'}</p>) : <p className="cr-document-note">未保存图片解析结果。</p>}
          <h4>全部评价分析</h4>{report.reviewAnalysis.map((item, itemIndex) => <p key={itemIndex}>{item.reviewId} · {{ positive: '正面', negative: '负面', neutral: '中性', mixed: '混合' }[item.sentiment]}：「{item.quote}」— {item.point}</p>)}
        </ReportDisclosure>
      </ReportDisclosure>) : <p className="cr-document-note">当前报告没有附加的单品全文，建议与来源见上文。</p>}
    </DocumentSectionBlock>
    <footer className="cr-document-end">制作方案为草案，发布前请核实我方商品资料。</footer>
  </article>
}
