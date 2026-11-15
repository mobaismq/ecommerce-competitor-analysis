import { useState, type ReactNode } from 'react'
import { ArrowUpRight, Copy, Search } from 'lucide-react'
import { creativeBrief, type CreativePlan, type CreativeScript } from '../../../shared/creative-report'
import type { ProductSkillReport } from '../../../shared/report-skill'
import { ReportMarkdown } from './SkillProductReports'

export const DOCUMENT_SECTIONS = [
  { id: 'overview', title: '报告总览' },
  { id: 'opportunities', title: '差异化机会清单' },
  { id: 'competitors', title: '已采集竞品' },
  { id: 'reviews', title: '评价洞察' },
  { id: 'main', title: '主图内容策划' },
  { id: 'detail', title: '详情页内容策划' },
  { id: 'sources', title: '素材与依据' },
  { id: 'research', title: '单品完整分析' },
] as const
export type DocumentSection = typeof DOCUMENT_SECTIONS[number]['id']

export interface ReportProduct {
  productId: string
  title: string | null
  shopName: string | null
  price: number | null
}

function DocumentSectionBlock({ id, children, note }: { id: DocumentSection; children: ReactNode; note?: string }) {
  const section = DOCUMENT_SECTIONS.find((item) => item.id === id)!
  return <section id={`creative-document-${id}`} className="cr-document-section" data-report-section={id} tabIndex={-1} aria-labelledby={`creative-document-heading-${id}`}>
    <h2 id={`creative-document-heading-${id}`}>{section.title}</h2>
    {note && <p className="cr-document-note">{note}</p>}
    {children}
  </section>
}

export function creativeScriptText(item: CreativeScript, plan: CreativePlan) {
  return `${item.order}. ${item.purpose}\n文案草案：${item.headline}\n画面安排：${item.visual}\n制作简报：${item.prompt}\n所需素材与使用条件：${item.requirements.join('；')}\n依据：${item.evidenceIds.map((id) => {
    const source = plan.evidence.find((entry) => entry.id === id)
    return source ? `${source.label}（商品 ${source.productId}）：${source.text}` : id
  }).join('\n')}`
}

function ScriptTable({ items, plan, onCopy, onEvidence, kind }: {
  items: CreativeScript[]
  plan: CreativePlan
  onCopy: (text: string) => void
  onEvidence: (ids: string[]) => void
  kind: 'main' | 'detail'
}) {
  return <>
    <div className="cr-document-section-tools">
      <span>{items.length} {kind === 'main' ? '张主图' : '屏详情'} · 文案、画面与制作条件</span>
      <button className="cr-document-text-button" onClick={() => onCopy(items.map((item) => creativeScriptText(item, plan)).join('\n\n'))}><Copy size={13} />复制全部{kind === 'main' ? '主图' : '详情'}脚本</button>
    </div>
    <div className="cr-document-table-scroll"><table className="cr-document-table cr-document-script-table">
      <caption className="sr-only">{kind === 'main' ? '主图' : '详情页'}内容脚本</caption>
      <thead><tr><th scope="col">{kind === 'main' ? '图序 / 任务' : '屏序 / 任务'}</th><th scope="col">文案草案</th><th scope="col">画面安排</th><th scope="col">制作条件 / 依据</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.order}>
        <th scope="row"><span className="cr-document-order">{String(item.order).padStart(2, '0')}</span><strong>{item.purpose}</strong></th>
        <td className="cr-document-copyline">{item.headline}</td>
        <td>{item.visual}</td>
        <td><ul>{item.requirements.length ? item.requirements.map((entry, index) => <li key={index}>{entry}</li>) : <li>核实我方商品与素材适用性</li>}</ul><div className="cr-document-cell-actions">
          <button className="cr-document-text-button" disabled={!item.evidenceIds.length} onClick={() => onEvidence(item.evidenceIds)}>{item.evidenceIds.length ? `${item.evidenceIds.length} 条依据` : '待补依据'}<ArrowUpRight size={12} /></button>
          <button className="cr-document-text-button" aria-label={`复制${kind === 'main' ? '主图' : '详情'} ${item.order} 脚本`} onClick={() => onCopy(creativeScriptText(item, plan))}><Copy size={12} />复制</button>
        </div></td>
      </tr>)}</tbody>
    </table></div>
    <details className="cr-document-disclosure"><summary>制作简报 · 可复制给设计师或作图工具</summary>
      {items.map((item) => <div className="cr-document-prompt" key={item.order}>
        <h3>{String(item.order).padStart(2, '0')} · {item.purpose}</h3><p>{item.prompt}</p>
        <button className="cr-document-text-button" onClick={() => onCopy(item.prompt)}><Copy size={12} />复制制作简报</button>
      </div>)}
    </details>
  </>
}

export function CreativeReportDocument({ plan, keyword, productReports = [], products, totalProducts, productsLoading, productsError, onRetryProducts, onCopy, onNavigate }: {
  plan: CreativePlan
  keyword: string
  productReports?: ProductSkillReport[]
  products: ReportProduct[]
  totalProducts: number
  productsLoading: boolean
  productsError: boolean
  onRetryProducts: () => void
  onCopy: (text: string) => void
  onNavigate: (section: DocumentSection, target?: 'evidence') => void
}) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [allEvidence, setAllEvidence] = useState(false)
  const brief = creativeBrief(plan)
  const sourceNumbers = new Map(plan.evidence.map((item, index) => [item.id, index + 1]))
  const showEvidence = (ids: string[]) => {
    setSelectedIds(ids)
    setQuery('')
    setAllEvidence(true)
    onNavigate('sources', 'evidence')
  }
  const sourceButton = (ids: string[]) => <button className="cr-document-text-button cr-document-citation" disabled={!ids.length} onClick={() => showEvidence(ids)} aria-label={`核对 ${ids.length} 条依据`}>
    {ids.length ? ids.map((id) => sourceNumbers.has(id) ? `[${sourceNumbers.get(id)}]` : id).join(' ') : '待补依据'}
  </button>
  const evidence = plan.evidence.filter((item) => (!selectedIds.length || selectedIds.includes(item.id)) && `${item.label} ${item.text} ${item.productId}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const reviewItems = productReports.flatMap((report) => report.reviewAnalysis.map((item) => ({ ...item, productId: report.productId, title: report.title })))
  const uniqueSignals = (sentiments: string[]) => {
    const seen = new Set<string>()
    return reviewItems.filter((item) => {
      if (!sentiments.includes(item.sentiment) || !item.quote.trim() || seen.has(item.point)) return false
      seen.add(item.point)
      return true
    }).slice(0, 3)
  }
  const positiveSignals = uniqueSignals(['positive'])
  const concernSignals = uniqueSignals(['negative', 'mixed'])
  const imageCounts = productReports.reduce((sum, report) => ({ used: sum.used + report.sampleCounts.imagesUsed, available: sum.available + report.sampleCounts.imagesAvailable }), { used: 0, available: 0 })
  const tableProducts = (products.length ? products : productReports.map((report) => ({ productId: report.productId, title: report.title, shopName: null, price: null }))).slice(0, 10)
  const reviewSection = (title: string, items: typeof reviewItems) => <div className="cr-document-review-group"><h3>{title}</h3>{items.map((item, index) => <div className="cr-document-review" key={`${item.productId}-${item.reviewId}-${index}`}>
    <h4>{index + 1}. {item.point}</h4><blockquote>“{item.quote}”</blockquote><p className="cr-document-attribution">商品 {item.productId} · {item.reviewId}</p>
  </div>)}</div>

  return <article className="cr-document-paper" aria-label="竞品分析报告正文">
    <DocumentSectionBlock id="overview">
      <h1>{keyword ? `${keyword} · 竞品分析与内容策划报告` : plan.title}</h1>
      <p className="cr-document-summary"><strong>总概览：</strong>{plan.dataCounts.products} 件竞品 / {plan.dataCounts.reviews} 条采集评价 / {plan.dataCounts.images} 条图片记录 / {plan.dataCounts.qa} 条问答。</p>
      <p><strong>建议方向：</strong>{brief.conclusion}</p>
      <p><strong>目标使用者与购买者：</strong>{plan.audience}</p>
      <p className="cr-document-note">{productReports.length ? `实际图片解析 ${imageCounts.used}/${imageCounts.available} 张。` : ''}文案与画面为策划草案，使用前需核对我方商品实物、参数和适用条件。</p>
    </DocumentSectionBlock>

    <DocumentSectionBlock id="opportunities" note="依据本批竞品资料确定内容切入点，按建议优先顺序整理。">
      {brief.priorities.length ? <div className="cr-document-table-scroll"><table className="cr-document-table cr-document-opportunity-table"><thead><tr><th scope="col">内容方向</th><th scope="col">竞品线索</th><th scope="col">我方建议动作</th><th scope="col">依据</th></tr></thead><tbody>
        {brief.priorities.map((item, index) => <tr key={index}><th scope="row"><span className="cr-document-order">{String(index + 1).padStart(2, '0')}</span>{item.title}</th><td>{item.finding}</td><td className="cr-document-emphasis">{item.action}</td><td>{sourceButton(item.evidenceIds)}</td></tr>)}
      </tbody></table></div> : <p className="cr-document-note">本报告尚无独立行动摘要，可继续阅读下方脚本和单品分析。</p>}
    </DocumentSectionBlock>

    <DocumentSectionBlock id="competitors" note={`本批共 ${totalProducts} 件竞品${totalProducts > 10 ? '，此处展示前 10 件，可在「查看采集数据」中查看全部' : ''}。下表为采集样本，不代表市场排名；价格为采集快照。`}>
      {productsLoading && <p className="cr-document-note" role="status">正在读取竞品信息…</p>}
      {productsError && <p className="cr-document-note">商品价格与店铺信息暂时无法读取。<button className="cr-document-text-button" onClick={onRetryProducts}>重新读取</button></p>}
      {!!tableProducts.length && <div className="cr-document-table-scroll"><table className="cr-document-table cr-document-product-table"><thead><tr><th scope="col">序号</th><th scope="col">商品 / ID</th><th scope="col">店铺</th><th scope="col">快照价</th><th scope="col">已存分析要点</th></tr></thead><tbody>{tableProducts.map((product, index) => <tr key={product.productId}>
        <td>{index + 1}</td><th scope="row">{product.title || '未采集标题'}<small>{product.productId}</small></th><td><span className="cr-document-shop" title={product.shopName || undefined}>{product.shopName || '未采集'}</span></td><td className="cr-document-price">{product.price != null && Number.isFinite(Number(product.price)) ? `¥${Number(product.price).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` : '未采集'}</td><td>{productReports.find((report) => report.productId === product.productId)?.sellingPoints.slice(0, 2).join('；') || '见下方单品完整分析'}</td>
      </tr>)}</tbody></table></div>}
      {!productsLoading && !tableProducts.length && <p className="cr-document-note">当前报告没有可展示的商品明细，可通过「查看采集数据」核对。</p>}
    </DocumentSectionBlock>

    <DocumentSectionBlock id="reviews" note="摘录已保存的评价分析，展示部分需求线索与体验分歧，不计算全市场热度或问题发生率。">
      {!!positiveSignals.length && reviewSection('好评关注点', positiveSignals)}
      {!!concernSignals.length && reviewSection('选购顾虑与体验分歧', concernSignals)}
      {!positiveSignals.length && !concernSignals.length && <p className="cr-document-note">当前报告未保存可单独展示的评价解析，请在下方单品分析及证据原文中核对。</p>}
    </DocumentSectionBlock>

    <DocumentSectionBlock id="main" note="每张主图解决一个购买问题；以下为内容脚本，文案需在确认我方资料后使用。">
      <ScriptTable items={plan.mainImages} plan={plan} onCopy={onCopy} onEvidence={showEvidence} kind="main" />
    </DocumentSectionBlock>

    <DocumentSectionBlock id="detail" note="按购买决策顺序展开，从商品定位、卖点依据到选购与使用问题。">
      <ScriptTable items={plan.detailImages} plan={plan} onCopy={onCopy} onEvidence={showEvidence} kind="detail" />
    </DocumentSectionBlock>

    <DocumentSectionBlock id="sources">
      <h3>我方待补素材</h3><ol className="cr-document-list">{plan.missingMaterials.map((item, index) => <li key={index}>{item}</li>)}</ol>
      <h3>数据局限与使用边界</h3><ul className="cr-document-list">{plan.risks.map((item, index) => <li key={index}>{item}</li>)}</ul>
      <div id="creative-document-evidence" className="cr-document-evidence-section" tabIndex={-1} aria-label="竞品证据原文">
      <div className="cr-document-evidence-heading"><h3>证据原文 <span>{evidence.length} 条</span></h3><label className="cr-document-search"><Search size={14} /><input aria-label="搜索证据" placeholder="搜索评价、标题或商品" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {!!selectedIds.length && <p className="cr-document-evidence-filter" role="status">已定位所选建议 / 脚本的 {evidence.length} 条依据。<button className="cr-document-text-button" onClick={() => setSelectedIds([])}>查看全部证据</button></p>}
      <div className="cr-document-evidence">{(allEvidence ? evidence : evidence.slice(0, 8)).map((item) => <div key={item.id}><p className="cr-document-evidence-label">[{sourceNumbers.get(item.id)}] {item.label} <span>商品 {item.productId}</span></p><p>{item.text}</p></div>)}</div>
      {!evidence.length && <p className="cr-document-note">没有匹配的证据，请调整搜索条件。</p>}
      {!allEvidence && evidence.length > 8 && <button className="cr-document-text-button" onClick={() => setAllEvidence(true)}>展开全部 {evidence.length} 条证据<ArrowUpRight size={12} /></button>}
      </div>
      <details className="cr-document-disclosure"><summary>竞品发现与内容动作汇总</summary>{plan.insights.map((item, index) => <div className="cr-document-prompt" key={index}><h3>{item.title}</h3><p><strong>发现：</strong>{item.finding}</p><p><strong>动作：</strong>{item.action} {sourceButton(item.evidenceIds)}</p></div>)}</details>
    </DocumentSectionBlock>

    <DocumentSectionBlock id="research" note="保留每件商品的分析过程、样本范围与已知局限，供进一步核对。">
      {plan.researchMarkdown ? <ReportMarkdown text={plan.researchMarkdown} /> : productReports.length ? productReports.map((report, index) => <div className="cr-document-product-research" key={report.productId}>
        <h3>{index + 1}. {report.title}</h3><p className="cr-document-note">商品 {report.productId} · 图片 {report.sampleCounts.imagesUsed}/{report.sampleCounts.imagesAvailable} 张 · 评价 {report.sampleCounts.reviewsUsed}/{report.sampleCounts.reviewsTotal} 条 · 问答 {report.sampleCounts.qaUsed}/{report.sampleCounts.qaTotal} 条</p>
        <p><strong>单品结论：</strong>{report.summary}</p><ReportMarkdown text={report.markdown} />
        {!!report.limitations.length && <><h4>补充局限</h4><ul className="cr-document-list">{report.limitations.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul></>}
        <details className="cr-document-disclosure"><summary>查看结论证据、图片解析与全部评价分析</summary>
          <h4>结论证据</h4>{report.evidence.map((item, itemIndex) => <p key={itemIndex}>{item.claim}【{item.confidence}】<br />{item.quote}<br /><span className="cr-document-note">来源：{item.sourceIds.join('、')}</span></p>)}
          <h4>图片 OCR 与视觉观察</h4>{report.imageObservations.length ? report.imageObservations.map((item) => <p key={item.imageId}>{item.imageId}：{item.observation}<br />可见文字：{item.ocr.join('、') || '未识别到文字'}</p>) : <p className="cr-document-note">未保存图片解析结果。</p>}
          <h4>全部评价分析</h4>{report.reviewAnalysis.map((item, itemIndex) => <p key={itemIndex}>{item.reviewId} · {{ positive: '正面', negative: '负面', neutral: '中性', mixed: '混合' }[item.sentiment]}：「{item.quote}」— {item.point}</p>)}
        </details>
      </div>) : <p className="cr-document-note">当前报告没有附加的单品全文，已存建议与依据见上文。</p>}
    </DocumentSectionBlock>
    <footer className="cr-document-end">报告完 · 以上建议基于本次采集样本，请结合我方商品资料落地。</footer>
  </article>
}
