import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProductSkillReport } from '../../../shared/report-skill'
import { ImageAssetList } from './ImageAssetList'

const base = { productId: 'p1', imageObservations: [{ imageId: 'main_image-0', observation: '外形', ocr: ['防水'] }],
  sampleCounts: { imagesAvailable: 3, imagesUsed: 1 } } as unknown as ProductSkillReport

describe('ImageAssetList', () => {
  it('shows per-image status and failure reasons', () => {
    const html = renderToStaticMarkup(<ImageAssetList report={{ ...base, imageAssets: [
      { id: 'main_image-0', kind: 'main_image', location: 'a', status: 'parsed' },
      { id: 'detail_image-0', kind: 'detail_image', location: 'b', status: 'failed', reason: '模型未返回该图解析' },
      { id: 'detail_image-1', kind: 'detail_image', location: 'c', status: 'skipped', reason: '单张图片超过 10MB' },
    ] }} />)
    expect(html).toContain('已解析 1 / 共 3 张')
    expect(html).toContain('模型未返回该图解析')
    expect(html).toContain('单张图片超过 10MB')
    expect(html).toContain('可见文字：防水')
  })
  it('falls back to the count for legacy reports without imageAssets', () => {
    const html = renderToStaticMarkup(<ImageAssetList report={base} />)
    expect(html).toContain('已解析 1 / 共 3 张')
    expect(html).not.toContain('image-asset-list')
  })
})
