import { BadRequestException } from '@nestjs/common'
import type { PublishListingDto } from './dto/publish-listing.dto'

/** 各平台必填字段表（单一权威定义）。未列出的平台没有强校验。 */
export const PLATFORM_REQUIRED_FIELDS: Record<string, string[]> = {
  taobao: ['title', 'categoryPath', 'storeId'],
  tmall: ['title', 'categoryPath', 'storeId'],
  jd: ['title', 'brand'],
  pdd: ['title'],
  douyin: ['title'],
}

const PLATFORM_DISPLAY: Record<string, string> = {
  taobao: '淘宝',
  tmall: '天猫',
  jd: '京东',
  pdd: '拼多多',
  douyin: '抖音',
  xhs: '小红书',
}

/** 返回指定平台缺失的必填字段列表；平台未登记时返回空数组。 */
export function requiredMissingFields(platform: string, dto: PublishListingDto): string[] {
  const normalized = platform.toLowerCase()
  const required = PLATFORM_REQUIRED_FIELDS[normalized]
  if (!required) return []
  const dtoView = dto as unknown as Record<string, unknown>
  return required.filter((field) => {
    const value = dtoView[field]
    return value === undefined || value === null || value === ''
  })
}

/** 校验必填字段，缺失则抛出带平台名与缺失项的 BadRequestException。 */
export function assertRequiredFields(platform: string, dto: PublishListingDto): void {
  const missing = requiredMissingFields(platform, dto)
  if (missing.length === 0) return
  const display = PLATFORM_DISPLAY[platform.toLowerCase()] ?? platform
  throw new BadRequestException(`平台${display}必填字段缺失：${missing.join('、')}`)
}