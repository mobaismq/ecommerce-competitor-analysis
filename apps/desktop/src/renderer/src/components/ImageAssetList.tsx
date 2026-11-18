import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { countImageAssets, type ProductSkillReport } from '../../../shared/report-skill'

const KIND_LABEL = { main_image: '主图', detail_image: '详情图', sku_image: 'SKU 图' } as const
const STATUS_LABEL = { parsed: '已解析', failed: '解析失败', skipped: '未读取' } as const
const STATUS_COLOR = { parsed: '#00875a', failed: '#d92d20', skipped: '#86909C' } as const

export function imageCountText(report: Pick<ProductSkillReport, 'sampleCounts'>) {
  return `已解析 ${report.sampleCounts.imagesUsed} / 共 ${report.sampleCounts.imagesAvailable} 张`
}

/** Pure per-image status list. Reports saved before full-image parsing have no imageAssets and only show the count. */
export function ImageAssetList({ report, thumbnails = {} }: { report: ProductSkillReport; thumbnails?: Record<string, string> }) {
  const assets = report.imageAssets
  if (!assets?.length) return <p className="text-[12px] text-[#86909C]">{imageCountText(report)}（该报告生成时未保存逐图明细，重新生成后可查看）</p>
  const counts = countImageAssets(assets)
  const observations = new Map(report.imageObservations.map((item) => [item.imageId, item]))
  return <div data-testid="image-asset-list">
    <p className="text-[12px] text-[#86909C]">{imageCountText(report)} · 解析失败 {counts.failed} · 未读取 {counts.skipped}</p>
    {assets.map((asset) => {
      const observation = observations.get(asset.id)
      return <div key={asset.id} className="my-2 flex gap-3 text-[13px]">
        {thumbnails[asset.id] ? <img src={thumbnails[asset.id]} alt={`${KIND_LABEL[asset.kind]} ${asset.id}`} loading="lazy" className="h-16 w-16 rounded object-cover" /> : <div className="h-16 w-16 shrink-0 rounded bg-[#f4f7fb]" />}
        <div>
          <span>{KIND_LABEL[asset.kind]} · {asset.id}</span> <strong style={{ color: STATUS_COLOR[asset.status] }}>{STATUS_LABEL[asset.status]}</strong>
          {asset.status !== 'parsed' && asset.reason ? <span className="text-[#86909C]">（{asset.reason}）</span> : null}
          {observation ? <p className="my-1">{observation.observation}<br />可见文字：{observation.ocr.join('、') || '未识别到文字'}</p> : null}
        </div>
      </div>
    })}
  </div>
}

/** Loads thumbnails only after the user opens the section; works without reportId (no thumbnails). */
export function ImageAssetPanel({ report, reportId }: { report: ProductSkillReport; reportId?: string }) {
  const [open, setOpen] = useState(false)
  const thumbnails = useQuery<Record<string, string>>({
    queryKey: ['report-image-assets', reportId, report.productId], enabled: open && Boolean(reportId && report.imageAssets?.length), retry: false,
    queryFn: async () => {
      const result = await window.desktop?.capabilities.invoke('report.references', { tenantId: 'local', runId: reportId, productId: report.productId }) as { images: Array<{ id: string; dataUrl: string }> } | undefined
      return Object.fromEntries((result?.images ?? []).map((image) => [image.id, image.dataUrl]))
    },
  })
  return <details onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
    <summary className="cursor-pointer text-[13px] font-semibold">逐图解析状态（{imageCountText(report)}）</summary>
    <ImageAssetList report={report} thumbnails={thumbnails.data} />
  </details>
}
