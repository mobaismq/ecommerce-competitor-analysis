import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, Copy, Download, FileText, Image as ImageIcon } from 'lucide-react'
import { Dropdown, Menu, Message } from '@arco-design/web-react'
import type { CreativePlan } from '../../../shared/creative-report'
import type { ProductSkillReport } from '../../../shared/report-skill'
import { creativePlanMarkdown } from '../../../shared/creative-report'
import { CreativeReportDocument, DOCUMENT_SECTIONS, type DocumentSection, type ReportProduct } from './CreativeReportDocument'
import { PageHeader } from './PageHeader'
import '../styles/creative-report.css'
import '../styles/creative-report-document.css'

type ReferenceImage = { id: string; productId: string; title: string; dataUrl: string }
type ReportMode = 'report' | 'images'

function ReferencePhoto({ image, className = '' }: { image?: ReferenceImage; className?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [image?.id])
  return <div className={`cr-document-photo ${className}`}>
    {image && !failed ? <img src={image.dataUrl} alt={`${image.title || image.productId}的竞品参考图`} loading="lazy" onError={() => setFailed(true)} /> : <div className="cr-document-photo-empty"><ImageIcon size={26} /><span>{failed ? '图片暂时无法显示' : '暂无参考图片'}</span></div>}
  </div>
}

export function CreativeReportView({ plan, reportId, reportNo, keyword, userId, updatedAt, productReports }: {
  plan: CreativePlan; reportId: string; reportNo: string | null; keyword: string; userId: string; updatedAt: string; productReports?: ProductSkillReport[]
}) {
  const [mode, setMode] = useState<ReportMode>('report')
  const [exporting, setExporting] = useState(false)
  const [activeSection, setActiveSection] = useState<DocumentSection>('overview')
  const [pendingSection, setPendingSection] = useState<{ section: DocumentSection; target?: 'evidence' } | null>(null)
  const [selectedProductId, setSelectedProductId] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const references = useQuery<{ images: ReferenceImage[] }>({
    queryKey: ['report-image-references', reportId, updatedAt], retry: false, staleTime: 60_000,
    queryFn: async () => await window.desktop?.capabilities.invoke('report.references', { tenantId: 'local', runId: reportId }) as { images: ReferenceImage[] },
  })
  const products = useQuery<{ products: ReportProduct[]; total: number }>({
    queryKey: ['report-document-products', reportId, updatedAt], retry: false, staleTime: 60_000,
    queryFn: async () => await window.desktop?.capabilities.invoke('report.products', { tenantId: 'local', runId: reportId, page: 1, pageSize: 10 }) as { products: ReportProduct[]; total: number },
  })

  useEffect(() => {
    setMode('report')
    setActiveSection('overview')
    setSelectedProductId('')
    root.current?.scrollTo({ top: 0 })
  }, [reportId])

  useEffect(() => {
    if (mode !== 'report' || !pendingSection) return
    const section = root.current?.querySelector<HTMLElement>(`#creative-document-${pendingSection.target || pendingSection.section}`)
    section?.scrollIntoView({ block: 'start', behavior: 'auto' })
    section?.focus({ preventScroll: true })
    setPendingSection(null)
  }, [mode, pendingSection])

  useEffect(() => {
    const scrollRoot = root.current
    if (!scrollRoot || mode !== 'report') return
    let frame = 0
    const trackSection = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const top = scrollRoot.getBoundingClientRect().top + 110
        const sections = Array.from(scrollRoot.querySelectorAll<HTMLElement>('[data-report-section]'))
        const current = sections.filter((section) => section.getBoundingClientRect().top <= top).at(-1)
        setActiveSection((current?.dataset.reportSection as DocumentSection | undefined) ?? 'overview')
      })
    }
    scrollRoot.addEventListener('scroll', trackSection, { passive: true })
    trackSection()
    return () => { scrollRoot.removeEventListener('scroll', trackSection); cancelAnimationFrame(frame) }
  }, [mode, reportId])

  const navigateSection = (section: DocumentSection, target?: 'evidence') => {
    setMode('report')
    setActiveSection(section)
    setPendingSection({ section, target })
  }
  const changeMode = (next: ReportMode) => {
    setMode(next)
    if (next === 'report') setPendingSection({ section: activeSection })
    else root.current?.scrollTo({ top: 0 })
  }
  const copy = async (content: string) => {
    try { await navigator.clipboard.writeText(content); Message.success('已复制，可粘贴给设计师或作图工具') }
    catch { Message.error('复制失败，请检查剪贴板权限后重试') }
  }
  const exportReport = async (format: 'markdown' | 'json' | 'html') => {
    setExporting(true)
    try {
      const result = await window.desktop?.capabilities.invoke('report.export', { tenantId: 'local', userId, runId: reportId, format }) as { content?: string }
      if (!result?.content) throw new Error('没有返回导出内容')
      const extension = format === 'markdown' ? 'md' : format
      const url = URL.createObjectURL(new Blob([result.content], { type: format === 'json' ? 'application/json;charset=utf-8' : format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${keyword || '竞品'}-出图策划.${extension}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      Message.success('报告已导出')
    } catch (error) { Message.error(`导出失败：${error instanceof Error ? error.message : String(error)}`) }
    finally { setExporting(false) }
  }
  const images = references.data?.images ?? []
  const covers = images.filter((image, index) => images.findIndex((entry) => entry.productId === image.productId) === index)
  const cover = covers.find((image) => image.productId === selectedProductId) ?? covers[0]
  const imageCounts = productReports?.reduce((sum, report) => ({ used: sum.used + report.sampleCounts.imagesUsed, available: sum.available + report.sampleCounts.imagesAvailable }), { used: 0, available: 0 })
  const reportTitle = keyword ? `${keyword} · 竞品内容策划` : plan.title
  const fullReportText = () => creativePlanMarkdown(plan, plan.researchMarkdown || productReports?.map((report) => `## ${report.title}\n\n${report.markdown}`).join('\n\n') || '')

  return <div ref={root} className="cr-page cr-document-page custom-scrollbar">
    <PageHeader breadcrumbs={[{ label: '市场' }, { label: '竞品分析' }, { label: '分析报告', to: '/market/competitive/report' }, { label: keyword || '竞品内容策划' }]} />
    <header className="cr-document-page-header">
      <div className="cr-document-page-title"><Link to="/market/competitive/report" className="cr-document-back" aria-label="返回报告列表"><ArrowLeft size={18} /></Link><div><h1>{reportTitle}</h1><p>{reportNo} · 更新于 {new Date(updatedAt).toLocaleString('zh-CN', { hour12: false })}</p></div></div>
      <div className="cr-actions"><Link className="cr-button" to={`/market/competitive/report/products?id=${encodeURIComponent(reportId)}`}>查看采集数据<ArrowUpRight size={14} /></Link>
        <Dropdown trigger="click" position="br" droplist={<Menu>{(['markdown', 'html', 'json'] as const).map((format) => <Menu.Item key={format} disabled={exporting} onClick={() => void exportReport(format)}>导出 {format === 'markdown' ? 'Markdown' : format.toUpperCase()}</Menu.Item>)}</Menu>}><button className="cr-button cr-primary" disabled={exporting}><Download size={14} />{exporting ? '导出中…' : '导出报告'}</button></Dropdown>
      </div>
    </header>

    <div className="cr-document-layout">
      <aside className="cr-document-sidebar" aria-label="报告资料与目录">
        <section className="cr-document-context">
          <h2>商品与策划需求</h2>
          {references.isLoading ? <div className="cr-document-photo cr-document-photo-empty" role="status"><ImageIcon size={26} /><span>正在读取商品图片…</span></div> : <button className="cr-document-cover-button" onClick={() => changeMode('images')} aria-label="查看竞品参考原图"><ReferencePhoto image={cover} /></button>}
          {covers.length > 1 && <div className="cr-document-thumbnails" aria-label="切换参考商品">{covers.map((image, index) => <button key={image.productId} title={image.title} aria-label={`查看商品 ${index + 1} 参考图`} aria-pressed={cover?.productId === image.productId} onClick={() => setSelectedProductId(image.productId)}><ReferencePhoto image={image} /></button>)}</div>}
          {cover && <p className="cr-document-product-caption" title={cover.title}>{cover.title || `商品 ${cover.productId}`}</p>}
          {references.isError && <p className="cr-document-note">原图暂时无法读取。<button className="cr-document-text-button" onClick={() => void references.refetch()}>重试</button></p>}
          <p className="cr-document-context-label">策划目标</p>
          <p className="cr-document-request">参考竞品资料，确定内容切入点，输出主图文案、详情页顺序与制作简报。</p>
          <dl className="cr-document-scope"><div><dt>竞品</dt><dd>{plan.dataCounts.products} 件</dd></div><div><dt>评价</dt><dd>{plan.dataCounts.reviews} 条</dd></div><div><dt>问答</dt><dd>{plan.dataCounts.qa} 条</dd></div><div><dt>图片解析</dt><dd>{imageCounts ? `${imageCounts.used} / ${imageCounts.available} 张` : `${plan.dataCounts.images} 条图片记录`}</dd></div></dl>
        </section>
        <nav className="cr-document-outline" aria-label="报告章节目录"><h2>报告目录</h2>{DOCUMENT_SECTIONS.map((section, index) => <button key={section.id} aria-current={mode === 'report' && activeSection === section.id ? 'location' : undefined} onClick={() => navigateSection(section.id)}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</button>)}</nav>
      </aside>

      <main className="cr-document-reader">
        <div className="cr-document-toolbar">
          <div className="cr-document-view-tabs" role="tablist" aria-label="报告视图">{([{ key: 'report', label: '分析报告', icon: FileText }, { key: 'images', label: '竞品原图', icon: ImageIcon }] as const).map(({ key, label, icon: Icon }) => <button key={key} id={`creative-view-${key}`} role="tab" aria-selected={mode === key} aria-controls={`creative-view-panel-${key}`} tabIndex={mode === key ? 0 : -1} onClick={() => changeMode(key)} onKeyDown={(event) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault()
              const next = event.key === 'Home' ? 'report' : event.key === 'End' ? 'images' : key === 'report' ? 'images' : 'report'
              changeMode(next)
              document.getElementById(`creative-view-${next}`)?.focus()
            }
          }}><Icon size={15} />{label}</button>)}</div>
          <button className="cr-document-text-button" onClick={() => void copy(fullReportText())}><Copy size={14} />复制完整报告</button>
        </div>
        <div id="creative-view-panel-report" role="tabpanel" aria-labelledby="creative-view-report" hidden={mode !== 'report'}>
          <CreativeReportDocument key={reportId} plan={plan} keyword={keyword} productReports={productReports} products={products.data?.products ?? []} totalProducts={products.data?.total ?? plan.dataCounts.products} productsLoading={products.isLoading} productsError={products.isError} onRetryProducts={() => void products.refetch()} onCopy={(text) => void copy(text)} onNavigate={navigateSection} />
        </div>
        <div id="creative-view-panel-images" role="tabpanel" aria-labelledby="creative-view-images" hidden={mode !== 'images'}>
          <div className="cr-document-reference-page"><h2>竞品原图参考</h2><p className="cr-document-note">原图供核对商品和画面，展示原图不代表已完成 AI 解析。当前最多展示本批前 6 件商品、每件 2 张主图。</p>
            {references.isLoading && <p className="cr-document-note" role="status">正在读取原图…</p>}
            {references.isError && <p className="cr-document-note">原图暂时无法读取。<button className="cr-document-text-button" onClick={() => void references.refetch()}>重新读取</button></p>}
            {references.isSuccess && !images.length && <p className="cr-document-note">当前没有可展示的本机原图，可通过「查看采集数据」核对采集资料。</p>}
            <div className="cr-document-gallery">{images.map((image) => <figure key={image.id}><ReferencePhoto image={image} /><figcaption>{image.title}<span>商品 {image.productId}</span></figcaption></figure>)}</div>
          </div>
        </div>
      </main>
    </div>
  </div>
}
