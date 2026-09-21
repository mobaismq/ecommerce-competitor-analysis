import { BadRequestException } from '@nestjs/common'
import { assertRequiredFields, requiredMissingFields } from './platform-required-fields'
import type { PublishListingDto } from './dto/publish-listing.dto'

function dto(partial: Partial<PublishListingDto> = {}): PublishListingDto {
  return { title: '商品标题', ...partial } as PublishListingDto
}

describe('platform 必填字段校验', () => {
  it('淘宝/天猫 必填 title/categoryPath/storeId', () => {
    expect(requiredMissingFields('taobao', dto({ categoryPath: '服饰', storeId: 's1' }))).toEqual([])
    expect(requiredMissingFields('tmall', dto({ categoryPath: '服饰', storeId: 's1' }))).toEqual([])
    expect(requiredMissingFields('taobao', dto())).toEqual(['categoryPath', 'storeId'])
    expect(requiredMissingFields('taobao', dto({ title: '', categoryPath: '', storeId: '' }))).toEqual([
      'title',
      'categoryPath',
      'storeId',
    ])
  })

  it('京东 必填 title/brand', () => {
    expect(requiredMissingFields('jd', dto({ brand: '自主品牌' }))).toEqual([])
    expect(requiredMissingFields('jd', dto())).toEqual(['brand'])
    expect(requiredMissingFields('jd', dto({ title: '' }))).toEqual(['title', 'brand'])
  })

  it('拼多多/抖音 必填 title', () => {
    expect(requiredMissingFields('pdd', dto())).toEqual([])
    expect(requiredMissingFields('douyin', dto())).toEqual([])
    expect(requiredMissingFields('pdd', dto({ title: '' }))).toEqual(['title'])
    expect(requiredMissingFields('douyin', dto({ title: undefined }))).toEqual(['title'])
  })

  it('未登记平台不校验', () => {
    expect(requiredMissingFields('xhs', dto())).toEqual([])
    expect(requiredMissingFields('unknown-platform', dto())).toEqual([])
  })

  it('满足时 assertRequiredFields 不抛错', () => {
    expect(() => assertRequiredFields('jd', dto({ brand: '自主品牌' }))).not.toThrow()
    expect(() => assertRequiredFields('taobao', dto({ categoryPath: '服饰', storeId: 's1' }))).not.toThrow()
  })

  it('缺失时抛出带平台名与缺失项的 BadRequestException', () => {
    expect(() => assertRequiredFields('jd', dto())).toThrow(BadRequestException)
    expect(() => assertRequiredFields('jd', dto())).toThrow('平台京东必填字段缺失：brand')
    expect(() => assertRequiredFields('taobao', dto())).toThrow('平台淘宝必填字段缺失：categoryPath、storeId')
  })
})
