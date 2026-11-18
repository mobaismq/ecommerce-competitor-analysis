export const REPORT_SKILL_VERSION = 'ecommerce-report-20261020-v1'
export const REPORT_SECTION_TITLES = ['数据源可用性概览', '商品标题分析', '商品核心卖点', '使用人群画像', '购买人群画像', '产品使用场景', '用户诉求及痛点', '分析局限与建议'] as const

export interface ReportSource {
  id: string
  kind: 'title' | 'main_image' | 'detail_image' | 'sku_image' | 'review' | 'qa'
  label: string
}

export type ImageAssetStatus = 'parsed' | 'failed' | 'skipped'

/** One collected image and what happened to it; the only source of image counts. */
export interface ImageAsset {
  id: string
  kind: 'main_image' | 'detail_image' | 'sku_image'
  location: string
  status: ImageAssetStatus
  reason?: string
}

export function countImageAssets(assets: ImageAsset[]) {
  const parsed = assets.filter((item) => item.status === 'parsed').length
  const skipped = assets.filter((item) => item.status === 'skipped').length
  return { total: assets.length, parsed, skipped, failed: assets.length - parsed - skipped }
}

export interface ProductSkillReport {
  productId: string
  title: string
  summary: string
  markdown: string
  model: string
  visionModel?: string
  sources: ReportSource[]
  evidence: Array<{ claim: string; sourceIds: string[]; quote: string; confidence: '多源印证' | '双源印证' | '单源推断' }>
  /** Absent in reports generated before full-image parsing. */
  imageAssets?: ImageAsset[]
  imageObservations: Array<{ imageId: string; observation: string; ocr: string[] }>
  reviewAnalysis: Array<{ reviewId: string; sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'; quote: string; point: string }>
  sampleCounts: { reviewsTotal: number; reviewsUsed: number; reviewsExcluded: number; qaTotal: number; qaUsed: number; imagesAvailable: number; imagesUsed: number }
  limitations: string[]
  sellingPoints: string[]
  painPoints: string[]
  userDemands: string[]
  opportunities: string[]
}
