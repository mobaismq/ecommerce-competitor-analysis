import type { ReactNode } from 'react'
import type { ProductSkillReport } from '../../../shared/report-skill'

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith('`') ? <code key={index}>{part.slice(1, -1)}</code> : part)
}

/** Render model text as React nodes; embedded HTML and executable links stay plain text. */
export function ReportMarkdown({ text }: { text: string }) {
  const lines = text.split('\n'), blocks: ReactNode[] = []
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'))
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) continue
    if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? '')) {
      const header = cells(line), rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) { rows.push(cells(lines[index])); index += 1 }
      index -= 1
      blocks.push(<div key={`table-${index}`} className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left text-[13px]"><thead><tr>{header.map((cell, i) => <th key={i} className="border border-[#e6e9ef] bg-[#f4f7fb] p-3">{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="min-w-[100px] border border-[#e6e9ef] p-3 align-top">{inline(cell)}</td>)}</tr>)}</tbody></table></div>)
    } else if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length
      blocks.push(<h3 key={index} className={`${level <= 2 ? 'mt-7 text-[18px]' : 'mt-5 text-[15px]'} mb-3 font-bold text-[#0A1B39]`}>{inline(line.replace(/^#+\s*/, ''))}</h3>)
    } else if (/^(?:[-*+]\s|\d+[.)、]\s?)/.test(line)) {
      blocks.push(<p key={index} className="my-1 pl-3">• {inline(line.replace(/^(?:[-*+]\s|\d+[.)、]\s?)/, ''))}</p>)
    } else if (!/^[-*_]{3,}$/.test(line)) blocks.push(<p key={index} className="my-2 whitespace-pre-wrap">{inline(line)}</p>)
  }
  return <div className="text-[14px] leading-7 text-[#344054]">{blocks}</div>
}

export function SkillProductReports({ reports }: { reports: ProductSkillReport[] }) {
  return <div className="my-5 space-y-5">{reports.map((report, index) => <details key={`${report.productId}-${index}`} open className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
    <summary className="cursor-pointer text-[18px] font-bold text-[#0A1B39]">{index + 1}. {report.title} <span className="text-[12px] font-normal text-[#86909C]">商品 {report.productId}</span></summary>
    <p className="my-3 rounded-lg bg-[#f0f7ff] p-3 text-[13px] text-[#344054]">{report.summary}</p>
    <p className="text-[12px] text-[#86909C]">实际使用：图片 {report.sampleCounts.imagesUsed}/{report.sampleCounts.imagesAvailable} 张 · 评价 {report.sampleCounts.reviewsUsed}/{report.sampleCounts.reviewsTotal} 条 · 问答 {report.sampleCounts.qaUsed}/{report.sampleCounts.qaTotal} 条</p>
    {report.limitations.length > 0 && <div className="my-3 rounded-lg bg-[#fff8e8] p-3 text-[13px] text-[#8c6526]">{report.limitations.map((item, i) => <p className="my-1" key={i}>{item}</p>)}</div>}
    <ReportMarkdown text={report.markdown} />
    <details className="mt-6 rounded-lg border border-[#e6e9ef] p-4"><summary className="cursor-pointer text-[14px] font-semibold">查看证据、图片解析和评价分析</summary>
      <h4 className="mb-2 mt-4">结论证据</h4>
      {report.evidence.length ? report.evidence.map((item, i) => <p key={i} className="my-2 text-[13px] leading-6">{item.claim} <strong className="text-[#3388ff]">【{item.confidence}】</strong><br />{item.quote}<br /><span className="text-[#86909C]">来源：{item.sourceIds.join('、')}</span></p>) : <p className="text-[13px] text-[#86909C]">未返回可核对的结论证据</p>}
      <h4 className="mb-2 mt-4">图片 OCR 与视觉观察</h4>
      {report.imageObservations.length ? report.imageObservations.map((item) => <p key={item.imageId} className="my-2 text-[13px]">{item.imageId}：{item.observation}<br />可见文字：{item.ocr.join('、') || '未识别到文字'}</p>) : <p className="text-[13px] text-[#86909C]">未返回图片解析结果</p>}
      <h4 className="mb-2 mt-4">评价解析</h4>
      {report.reviewAnalysis.map((item, i) => <p key={i} className="my-2 text-[13px]">{item.reviewId} · {{ positive: '正面', negative: '负面', neutral: '中性', mixed: '混合' }[item.sentiment]}：「{item.quote}」— {item.point}</p>)}
    </details>
  </details>)}</div>
}
