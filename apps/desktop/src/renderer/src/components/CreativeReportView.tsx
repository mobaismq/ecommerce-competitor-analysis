import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Copy, Download, Search, Sparkles } from 'lucide-react'
import { Dropdown, Menu, Message } from '@arco-design/web-react'
import type { CreativePlan, CreativeScript } from '../../../shared/creative-report'
import type { ProductSkillReport } from '../../../shared/report-skill'
import { creativePlanMarkdown, creativeBrief } from '../../../shared/creative-report'
import { CreativeReportOverview } from './CreativeReportOverview'
import { REPORT_SECTIONS, ReportSectionGuide, type ReportSection } from './ReportSectionGuide'
import { PageHeader } from './PageHeader'
import { ReportMarkdown, SkillProductReports } from './SkillProductReports'
import '../styles/creative-report.css'

export function CreativeReportView({ plan, reportId, reportNo, keyword, userId, updatedAt, productReports }: {
  plan: CreativePlan; reportId: string; reportNo: string | null; keyword: string; userId: string; updatedAt: string; productReports?: ProductSkillReport[]
}) {
  const [tab, setTab] = useState<ReportSection>('overview')
  const [query, setQuery] = useState(''), [exporting, setExporting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [allEvidence, setAllEvidence] = useState(false)
  const root = useRef<HTMLDivElement>(null), evidenceSection = useRef<HTMLDivElement>(null)
  const references = useQuery<{ images: Array<{ id: string; productId: string; title: string; dataUrl: string }> }>({
    queryKey: ['report-image-references', reportId, updatedAt], enabled: tab === 'sources', retry: false,
    queryFn: async () => await window.desktop?.capabilities.invoke('report.references', { tenantId: 'local', runId: reportId }) as { images: Array<{ id: string; productId: string; title: string; dataUrl: string }> },
  })
  useEffect(() => {
    if (tab === 'sources' && selectedIds.length) {
      evidenceSection.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      evidenceSection.current?.focus({ preventScroll: true })
    }
  }, [tab, selectedIds])
  const copy = async (content: string) => { try { await navigator.clipboard.writeText(content); Message.success('已复制，可粘贴给设计师或作图工具') } catch { Message.error('复制失败，请检查剪贴板权限后重试') } }
  const changeTab = (next: ReportSection) => { setTab(next); root.current?.scrollTo({ top: 0, behavior: 'auto' }) }
  const openSection = (next: ReportSection) => { setSelectedIds([]); setQuery(''); if (next === 'sources') setAllEvidence(false); changeTab(next) }
  const showEvidence = (ids: string[]) => { setSelectedIds([...ids]); setQuery(''); setAllEvidence(true); changeTab('sources') }
  const exportReport = async (format: 'markdown' | 'json' | 'html') => {
    setExporting(true)
    try {
      const result = await window.desktop?.capabilities.invoke('report.export', { tenantId: 'local', userId, runId: reportId, format }) as { content?: string }
      if (!result?.content) throw new Error('没有返回导出内容')
      const extension = format === 'markdown' ? 'md' : format
      const url = URL.createObjectURL(new Blob([result.content], { type: format === 'json' ? 'application/json;charset=utf-8' : format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' }))
      const link = document.createElement('a'); link.href = url; link.download = `${keyword || '竞品'}-出图策划.${extension}`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      Message.success('报告已导出')
    } catch (error) { Message.error(`导出失败：${error instanceof Error ? error.message : String(error)}`) }
    finally { setExporting(false) }
  }
  const evidence = plan.evidence.filter((item) => (!selectedIds.length || selectedIds.includes(item.id)) && `${item.label} ${item.text} ${item.productId}`.includes(query))
  const brief = creativeBrief(plan)
  const imageCounts = productReports?.reduce((total, report) => ({ used: total.used + report.sampleCounts.imagesUsed, available: total.available + report.sampleCounts.imagesAvailable }), { used: 0, available: 0 })
  const scripts = tab === 'detail' ? plan.detailImages : plan.mainImages
  const output: Record<ReportSection, string> = { overview: `${brief.priorities.length} 项优先建议`, main: `${plan.mainImages.length} 张主图文字脚本`, detail: `${plan.detailImages.length} 屏详情文字脚本`, sources: '待补素材清单 + 竞品证据', research: `${productReports?.length ?? plan.dataCounts.products} 件竞品的分析过程` }
  const scriptText = (item: CreativeScript) => `${item.order}. ${item.purpose}\n文案草案：${item.headline}\n画面安排：${item.visual}\n画面简报：${item.prompt}\n待补材料：${item.requirements.join('；')}\n证据：${item.evidenceIds.map((id) => { const source = plan.evidence.find((entry) => entry.id === id); return source ? `${source.label}（商品${source.productId}）：${source.text}` : id }).join('\n')}`
  return <div ref={root} className="cr-page cr-report-focus cr-report-structured custom-scrollbar">
    <PageHeader breadcrumbs={[{ label: '市场' }, { label: '竞品分析' }, { label: '分析报告' }, { label: '竞品内容策划' }]} />
    <Link to="/market/competitive/report" className="cr-back"><ArrowLeft size={14} />返回报告列表</Link>
    <div className="cr-title-row">
      <div><div className="cr-eyebrow"><Sparkles size={14} />竞品研究 → 内容策划 <span className="cr-report-ready">报告已生成</span></div><h1>{keyword ? `${keyword} · 竞品内容策划报告` : plan.title}</h1><p className="cr-meta">{reportNo} · 更新于 {new Date(updatedAt).toLocaleString('zh-CN', { hour12: false })}</p></div>
      <div className="cr-actions"><Link className="cr-button" to={`/market/competitive/report/products?id=${encodeURIComponent(reportId)}`}>查看采集数据<ArrowUpRight size={14} /></Link>
        <Dropdown trigger="click" position="br" droplist={<Menu>{(['markdown', 'html', 'json'] as const).map((format) => <Menu.Item key={format} disabled={exporting} onClick={() => void exportReport(format)}>导出 {format === 'markdown' ? 'Markdown' : format.toUpperCase()}</Menu.Item>)}</Menu>}><button className="cr-button cr-primary" disabled={exporting}><Download size={14} />{exporting ? '导出中…' : '导出报告'}</button></Dropdown>
      </div>
    </div>
    <section className="cr-report-purpose" aria-label="这份报告的用途"><div><strong>这份报告帮你做什么？</strong><p>用竞品资料确定我方卖点，再整理成可交给设计师的主图与详情页脚本。</p></div><span>交付：建议 + 文字脚本 + 依据</span></section>
    <div className="cr-report-data" aria-label="本报告的数据基础"><strong>数据基础</strong><span>{plan.dataCounts.products} 件竞品</span><span>{plan.dataCounts.reviews} 条采集评价</span>{imageCounts ? <span>图片已解析 {imageCounts.used}/{imageCounts.available} 张</span> : <span>图片记录 {plan.dataCounts.images} 条</span>}<span>问答 {plan.dataCounts.qa} 条</span>{imageCounts && imageCounts.available > 0 && !imageCounts.used && <span className="cr-data-caveat">画面建议待实物核对</span>}</div>
    <section className="cr-workbench">
      <div className="cr-navigation-heading"><strong>按问题找内容</strong><span>前 3 项用于定方向与出脚本，后 2 项用于核对和深读。</span></div>
      <div className="cr-tabs cr-section-tabs" role="tablist" aria-label="报告阅读导航">{REPORT_SECTIONS.map((section) => <button key={section.key} role="tab" tabIndex={tab === section.key ? 0 : -1} onKeyDown={(event) => {
        const index = REPORT_SECTIONS.findIndex(item => item.key === section.key)
        const next = event.key === 'ArrowRight' ? REPORT_SECTIONS[(index + 1) % REPORT_SECTIONS.length] : event.key === 'ArrowLeft' ? REPORT_SECTIONS[(index + REPORT_SECTIONS.length - 1) % REPORT_SECTIONS.length] : event.key === 'Home' ? REPORT_SECTIONS[0] : event.key === 'End' ? REPORT_SECTIONS[REPORT_SECTIONS.length - 1] : null
        if (next) { event.preventDefault(); openSection(next.key); document.getElementById(`creative-tab-${next.key}`)?.focus() }
      }} aria-selected={tab === section.key} aria-controls="creative-report-panel" id={`creative-tab-${section.key}`} className={tab === section.key ? 'active' : ''} onClick={() => openSection(section.key)}><span className="cr-section-number">{section.number}</span><div><strong>{section.title}</strong><small>{section.caption}</small></div></button>)}</div>
      <div id="creative-report-panel" role="tabpanel" aria-labelledby={`creative-tab-${tab}`}>
        <ReportSectionGuide section={tab} output={output[tab]} />
        <div className="cr-panel-tools"><button className="cr-text-button" onClick={() => void copy(tab === 'main' || tab === 'detail' ? scripts.map(scriptText).join('\n\n') : creativePlanMarkdown(plan))}><Copy size={14} />{tab === 'main' ? '复制全部主图脚本' : tab === 'detail' ? '复制全部详情脚本' : '复制完整策划'}</button></div>
        {tab === 'overview' && <CreativeReportOverview plan={plan} onEvidence={showEvidence} onScripts={openSection} onMaterials={() => openSection('sources')} />}
        {(tab === 'main' || tab === 'detail') && <>
          <div className="cr-script-instructions"><strong>每张卡片是一{tab === 'main' ? '张主图' : '屏详情'}的制作任务</strong><p>先看本图任务和文案；需要制作时，展开画面安排、所需素材和制作简报。确认我方信息后再用于出图。</p></div>
          <div className="cr-script-grid">{scripts.map((item) => <article className="cr-script" key={item.order}>
            <div className="cr-script-top"><span className={`cr-number ${tab === 'detail' ? 'violet' : ''}`}>{String(item.order).padStart(2, '0')}</span><div><span className="cr-small-label">{tab === 'main' ? `主图 ${item.order} · 本图任务` : `详情第 ${item.order} 屏 · 本屏任务`}</span><h3>{item.purpose}</h3></div></div>
            <div className="cr-headline"><span>可上图的文案草案</span><p>{item.headline}</p></div>
            <details className="cr-script-details"><summary>查看画面安排、所需素材与制作简报</summary><div className="cr-script-body"><h4>画面安排｜告诉设计怎么排</h4><p>{item.visual}</p><h4>所需素材与使用条件｜制作前要备齐</h4><ul className="cr-requirements">{item.requirements.length ? item.requirements.map((entry, index) => <li key={index}>{entry}</li>) : <li>请核实我方商品实物与素材适用性</li>}</ul><details className="cr-prompt"><summary>制作简报｜可复制给设计师或作图工具</summary><p>{item.prompt}</p><button className="cr-text-button" onClick={() => void copy(item.prompt)}><Copy size={13} />复制制作简报</button></details></div></details>
            <footer className="cr-script-footer"><button className="cr-text-button" disabled={!item.evidenceIds.length} onClick={() => showEvidence(item.evidenceIds)}>{item.evidenceIds.length ? `核对本图的 ${item.evidenceIds.length} 条依据` : '本图待补依据'}<ArrowUpRight size={13} /></button><button className="cr-copy-button" onClick={() => void copy(scriptText(item))}><Copy size={13} />复制本图脚本</button></footer>
          </article>)}</div>
        </>}
        {tab === 'sources' && <div className="cr-sources">
          <section className="cr-source-preparation"><div className="cr-section-intro"><div><h3>制作准备｜我方还要补什么</h3><p>下方是待准备的资料清单；竞品资料不能代替我方实物、参数和使用条件。</p></div></div><div className="cr-two-columns"><section className="cr-materials"><h4>待补的我方素材 · {plan.missingMaterials.length} 项</h4><ul>{plan.missingMaterials.map((item, index) => <li key={index}>{item}</li>)}</ul></section><section className="cr-limits"><h4>数据局限与使用边界 · {plan.risks.length} 项</h4><ul>{plan.risks.map((item, index) => <li key={index}>{item}</li>)}</ul></section></div></section>
          <div ref={evidenceSection} tabIndex={-1} className="cr-evidence-section" aria-label="竞品证据原文">
            <div className="cr-section-intro"><div><h3>证据原文｜建议具体来自哪里 <span className="cr-count">{evidence.length} 条</span></h3><p>保留标题、评价等原始资料；可搜索文字，也可从建议或脚本直接跳到对应依据。</p></div><label className="cr-search"><Search size={15} /><input aria-label="搜索证据" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索评价、标题或商品" /></label></div>
            {selectedIds.length > 0 && <div className="cr-evidence-filter">仅显示刚才所选建议或脚本的 {selectedIds.length} 条依据 <button className="cr-text-button" onClick={() => setSelectedIds([])}>查看全部证据</button></div>}
            <div className="cr-evidence-list">{(allEvidence ? evidence : evidence.slice(0, 8)).map((item) => <article key={item.id}><div><span className="cr-tag">{item.label}</span><span>商品 {item.productId}</span></div><p>{item.text}</p></article>)}</div>
            {!evidence.length && <p className="cr-muted">没有匹配的证据，请调整搜索条件。</p>}{!allEvidence && evidence.length > 8 && <button className="cr-button" onClick={() => setAllEvidence(true)}>展开全部 {evidence.length} 条证据</button>}
          </div>
          <details className="cr-source-more"><summary>竞品发现汇总｜把原始资料归纳成哪些线索</summary><div className="cr-insight-grid">{plan.insights.map((item, index) => <article className="cr-insight" key={index}><span className="cr-small-label">竞品发现 {String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.finding}</p><div><b>建议动作</b><p>{item.action}</p></div><button className="cr-text-button" disabled={!item.evidenceIds.length} onClick={() => showEvidence(item.evidenceIds)}>核对这项发现的依据<ArrowUpRight size={12} /></button></article>)}</div></details>
          <details className="cr-source-more"><summary>竞品原图参考｜供人工核对画面与商品</summary><p className="cr-source-explainer">原图展示与 AI 解析是两个环节，能看到原图不代表已完成图片分析。</p>{references.isLoading && <p className="cr-muted">正在读取本机图片…</p>}{references.isError && <p className="cr-muted">图片暂时无法读取，可先查看标题和评价依据。<button className="cr-text-button" onClick={() => void references.refetch()}>重新读取</button></p>}{references.isSuccess && !references.data?.images.length && <p className="cr-muted">当前没有可展示的原图，可先查看标题和评价依据。</p>}<div className="cr-reference-grid">{references.data?.images.map((item) => <figure key={item.id}><img src={item.dataUrl} alt={`${item.title ?? item.productId}的竞品参考图`} loading="lazy" /><figcaption>{item.title}<span>商品 {item.productId}</span></figcaption></figure>)}</div></details>
        </div>}
        {tab === 'research' && <div className="cr-research"><p className="cr-research-instructions">这里保留每件竞品的八模块分析、样本范围和证据。先读单品结论，需要细节时再展开全文。</p>{plan.researchMarkdown ? <ReportMarkdown text={plan.researchMarkdown} /> : productReports?.length ? <SkillProductReports reports={productReports} /> : <ReportMarkdown text={creativePlanMarkdown(plan)} />}</div>}
      </div>
    </section>
  </div>
}
