export const REPORT_SECTIONS = [
  { key: 'overview', number: '01', title: '结论与行动', caption: '先决定优先做什么', audience: '运营先看', question: '竞品有哪些值得参考的信号，我方应优先做什么？' },
  { key: 'main', number: '02', title: '主图策划', caption: '每张主图讲什么', audience: '运营与设计', question: '每张主图要突出什么卖点，文案和画面怎么安排？' },
  { key: 'detail', number: '03', title: '详情页策划', caption: '按什么顺序讲商品', audience: '运营与设计', question: '详情页如何按购买问题展开，让买家理解商品？' },
  { key: 'sources', number: '04', title: '素材与依据', caption: '缺什么、依据是什么', audience: '制作前核对', question: '还要准备哪些我方素材，建议又来自哪些竞品资料？' },
  { key: 'research', number: '05', title: '单品完整分析', caption: '深入看每件竞品', audience: '需要深读时', question: '每件竞品的卖点、人群、场景和痛点，是怎样分析出来的？' },
] as const
export type ReportSection = typeof REPORT_SECTIONS[number]['key']

export function ReportSectionGuide({ section, output }: { section: ReportSection; output: string }) {
  const item = REPORT_SECTIONS.find(item => item.key === section)!
  return <header className="cr-module-guide">
    <div><span className="cr-module-label">模块 {item.number} · {item.audience}</span><h2>{item.title}</h2><p>{item.question}</p></div>
    <div className="cr-module-output"><span>本模块交付</span><strong>{output}</strong></div>
  </header>
}
