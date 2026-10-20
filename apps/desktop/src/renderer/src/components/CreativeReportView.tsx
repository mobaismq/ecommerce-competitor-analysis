import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Check, ClipboardList, Copy, Download, Image as ImageIcon, Layers3, Search, Sparkles } from 'lucide-react'
import { Dropdown, Menu, Message } from '@arco-design/web-react'
import type { CreativePlan, CreativeScript } from '../../../shared/creative-report'
import type { ProductSkillReport } from '../../../shared/report-skill'
import { creativePlanMarkdown } from '../../../shared/creative-report'
import { PageHeader } from './PageHeader'
import { ReportMarkdown, SkillProductReports } from './SkillProductReports'
import '../styles/creative-report.css'

type Tab = 'main' | 'detail' | 'sources' | 'research'
const labels: Record<Tab, string> = { main: '主图脚本', detail: '详情页脚本', sources: '竞品依据', research: '完整分析' }
export function CreativeReportView({ plan, reportId, reportNo, keyword, userId, updatedAt, productReports }: {
  plan: CreativePlan; reportId: string; reportNo: string | null; keyword: string; userId: string; updatedAt: string; productReports?: ProductSkillReport[]
}) {
  const [tab, setTab] = useState<Tab>('main'), [query, setQuery] = useState(''), [exporting, setExporting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [allEvidence, setAllEvidence] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const references = useQuery<{ images: Array<{ id: string; productId: string; title: string; dataUrl: string }> }>({
    queryKey: ['report-image-references', reportId, updatedAt], enabled: tab === 'sources', retry: false,
    queryFn: async () => await window.desktop?.capabilities.invoke('report.references', { tenantId: 'local', runId: reportId }) as { images: Array<{ id: string; productId: string; title: string; dataUrl: string }> },
  })
  const copy = async (content: string) => { try { await navigator.clipboard.writeText(content); Message.success('已复制，可粘贴给美工或作图工具') } catch { Message.error('复制失败，请检查剪贴板权限后重试') } }
  const changeTab = (next: Tab) => { setTab(next); root.current?.scrollTo({ top: 0, behavior: 'smooth' }) }
  const showEvidence = (ids: string[]) => { setSelectedIds(ids); setQuery(''); setAllEvidence(true); changeTab('sources') }
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
  const scripts = tab === 'detail' ? plan.detailImages : plan.mainImages
  const scriptText = (item: CreativeScript) => `${item.order}. ${item.purpose}\n文案草案：${item.headline}\n画面安排：${item.visual}\n画面简报：${item.prompt}\n待补材料：${item.requirements.join('；')}\n证据：${item.evidenceIds.map((id) => { const source = plan.evidence.find((entry) => entry.id === id); return source ? `${source.label}（商品${source.productId}）：${source.text}` : id }).join('\n')}`
  return <div ref={root} className="cr-page custom-scrollbar">
    <PageHeader breadcrumbs={[{ label: '市场' }, { label: '竞品分析' }, { label: '分析报告' }, { label: '出图内容策划' }]} />
    <Link to="/market/competitive/report" className="cr-back"><ArrowLeft size={14} />返回报告列表</Link>
    <div className="cr-title-row"><div><div className="cr-eyebrow"><Sparkles size={14} />主图 / 详情页内容策划</div><h1>{plan.title}</h1><p className="cr-meta">{reportNo} · 更新于 {new Date(updatedAt).toLocaleString('zh-CN', { hour12: false })}</p></div>
      <div className="cr-actions"><Link className="cr-button" to={`/market/competitive/report/products?id=${encodeURIComponent(reportId)}`}>查看采集数据<ArrowUpRight size={14} /></Link>
        <Dropdown trigger="click" position="br" droplist={<Menu>{(['markdown', 'html', 'json'] as const).map((format) => <Menu.Item key={format} disabled={exporting} onClick={() => void exportReport(format)}>导出 {format === 'markdown' ? 'Markdown' : format.toUpperCase()}</Menu.Item>)}</Menu>}><button className="cr-button cr-primary" disabled={exporting}><Download size={14} />{exporting ? '导出中…' : '导出报告'}</button></Dropdown>
      </div>
    </div>
    <section className="cr-direction"><div className="cr-direction-label"><span className="cr-dot" />本次内容方向</div><h2>{plan.direction}</h2><p>{plan.audience}</p><div className="cr-direction-foot"><span><Check size={13} />每张图有文案、画面与证据</span><span><ClipboardList size={13} />我方参数和功能需核实后使用</span></div></section>
    <div className="cr-stat-grid"><div className="cr-stat"><span className="cr-stat-icon"><ImageIcon size={19} /></span><div><b>{plan.mainImages.length}<small> 张主图</small></b><span>定位、卖点与选购信息</span></div></div><div className="cr-stat"><span className="cr-stat-icon violet"><Layers3 size={19} /></span><div><b>{plan.detailImages.length}<small> 屏详情</small></b><span>从适用人群到使用与 FAQ</span></div></div><div className="cr-stat"><span className="cr-stat-icon teal"><ClipboardList size={19} /></span><div><b>{plan.dataCounts.products}<small> 件竞品</small></b><span>{plan.dataCounts.reviews} 条评价 · {plan.dataCounts.images} 条图片记录</span></div></div></div>
    <section className="cr-workbench"><div className="cr-tabbar"><div className="cr-tabs" role="tablist" aria-label="报告内容">{(Object.keys(labels) as Tab[]).map((key) => <button key={key} role="tab" tabIndex={tab === key ? 0 : -1} onKeyDown={(event) => {
        const keys = Object.keys(labels) as Tab[], index = keys.indexOf(key)
        const next = event.key === 'ArrowRight' ? keys[(index + 1) % keys.length] : event.key === 'ArrowLeft' ? keys[(index + keys.length - 1) % keys.length] : event.key === 'Home' ? keys[0] : event.key === 'End' ? keys[keys.length - 1] : null
        if (next) { event.preventDefault(); setSelectedIds([]); changeTab(next); document.getElementById(`creative-tab-${next}`)?.focus() }
      }} aria-selected={tab === key} aria-controls="creative-report-panel" id={`creative-tab-${key}`} className={tab === key ? 'active' : ''} onClick={() => { if (key === 'sources') setSelectedIds([]); changeTab(key) }}>{labels[key]}{(key === 'main' || key === 'detail') && <span>{key === 'main' ? plan.mainImages.length : plan.detailImages.length}</span>}</button>)}</div><button className="cr-text-button" onClick={() => void copy(tab === 'main' || tab === 'detail' ? scripts.map(scriptText).join('\n\n') : creativePlanMarkdown(plan))}><Copy size={14} />复制{tab === 'main' || tab === 'detail' ? '本组脚本' : '完整策划'}</button></div>
      <div id="creative-report-panel" role="tabpanel" aria-labelledby={`creative-tab-${tab}`}>
      {(tab === 'main' || tab === 'detail') && <><div className="cr-section-intro"><div><h2>{tab === 'main' ? '每张主图，解决一个购买问题' : '按购买决策顺序，组织详情页内容'}</h2><p>以下为可执行的内容草案。点击依据可回看竞品证据，方括号为待填内容。</p></div><span className="cr-tag">{scripts.length} 个内容任务</span></div><div className="cr-script-grid">{scripts.map((item) => <article className="cr-script" key={item.order}><div className="cr-script-top"><span className={`cr-number ${tab === 'detail' ? 'violet' : ''}`}>{String(item.order).padStart(2, '0')}</span><div><span className="cr-small-label">{tab === 'main' ? '主图任务' : '详情屏任务'}</span><h3>{item.purpose}</h3></div></div><div className="cr-headline"><span>文案草案</span><p>{item.headline}</p></div><div className="cr-script-body"><h4>画面安排</h4><p>{item.visual}</p><h4>待补素材 / 使用条件</h4><ul className="cr-requirements">{item.requirements.length ? item.requirements.map((entry, index) => <li key={index}>{entry}</li>) : <li>请核实我方商品实物与素材适用性</li>}</ul><details className="cr-prompt"><summary>查看画面简报</summary><p>{item.prompt}</p><button className="cr-text-button" onClick={() => void copy(item.prompt)}><Copy size={13} />复制画面简报</button></details></div><footer className="cr-script-footer"><button className="cr-text-button" disabled={!item.evidenceIds.length} onClick={() => showEvidence(item.evidenceIds)}>{item.evidenceIds.length ? `${item.evidenceIds.length} 条依据` : '待补证据'}<ArrowUpRight size={13} /></button><button className="cr-copy-button" onClick={() => void copy(scriptText(item))}><Copy size={13} />复制脚本</button></footer></article>)}</div></>}
      {tab === 'sources' && <div className="cr-sources"><div className="cr-section-intro"><div><h2>从竞品证据，找到内容动作</h2><p>来源用于理解用户需求；竞品宣传和个体评价不等于我方产品效果。</p></div></div><div className="cr-insight-grid">{plan.insights.map((item, index) => <article className="cr-insight" key={index}><span className="cr-small-label">竞品发现 {String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.finding}</p><div><b>内容动作</b><p>{item.action}</p></div><button className="cr-text-button" disabled={!item.evidenceIds.length} onClick={() => { setSelectedIds(item.evidenceIds); setAllEvidence(true) }}>核对依据<ArrowUpRight size={12} /></button></article>)}</div>
        <h3 className="cr-block-title">竞品原图参考</h3>{references.isLoading && <p className="cr-muted">正在读取本机图片…</p>}{references.isError && <p className="cr-muted">图片暂时无法读取，可查看下方图片解析证据。<button className="cr-text-button" onClick={() => void references.refetch()}>重新读取</button></p>}<div className="cr-reference-grid">{references.data?.images.map((item) => <figure key={item.id}><img src={item.dataUrl} alt={`${item.title ?? item.productId}的竞品参考图`} loading="lazy" /><figcaption>{item.title}<span>商品 {item.productId}</span></figcaption></figure>)}</div>
        <div className="cr-section-intro"><div><h3>证据库 <span className="cr-count">{evidence.length}</span></h3><p>每条记录保留商品来源，支持按文字检索。</p></div><label className="cr-search"><Search size={15} /><input aria-label="搜索证据" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索评价、图片文字或商品" /></label></div>{selectedIds.length > 0 && <div className="cr-evidence-filter">当前仅显示本脚本依据 <button className="cr-text-button" onClick={() => setSelectedIds([])}>查看全部证据</button></div>}<div className="cr-evidence-list">{(allEvidence ? evidence : evidence.slice(0, 8)).map((item) => <article key={item.id}><div><span className="cr-tag">{item.label}</span><span>商品 {item.productId}</span></div><p>{item.text}</p></article>)}</div>{!evidence.length && <p className="cr-muted">没有匹配的证据，请调整搜索条件。</p>}{!allEvidence && evidence.length > 8 && <button className="cr-button" onClick={() => setAllEvidence(true)}>展开全部 {evidence.length} 条证据</button>}
        <div className="cr-two-columns"><section className="cr-materials"><h3>开拍前补齐的素材</h3><ul>{plan.missingMaterials.map((item, index) => <li key={index}>{item}</li>)}</ul></section><section className="cr-limits"><h3>本次数据局限</h3><ul>{plan.risks.map((item, index) => <li key={index}>{item}</li>)}</ul></section></div>
      </div>}
      {tab === 'research' && <div className="cr-research"><div className="cr-section-intro"><div><h2>完整竞品研究与策划依据</h2><p>保留数据范围、分析过程和各项建议的适用条件。</p></div></div>{plan.researchMarkdown ? <ReportMarkdown text={plan.researchMarkdown} /> : productReports?.length ? <SkillProductReports reports={productReports} /> : <ReportMarkdown text={creativePlanMarkdown(plan)} />}</div>}
      </div>
    </section>
  </div>
}
