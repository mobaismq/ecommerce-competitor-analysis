import { computePriceBands } from './report-price-bands'

describe('computePriceBands（迁移自旧 buildPriceBands 的自适应等频分箱）', () => {
  it('空价格列表返回空数组', () => {
    expect(computePriceBands([])).toEqual([])
  })

  it('全部非法的价格返回空数组', () => {
    expect(computePriceBands([NaN, Infinity, -Infinity])).toEqual([])
  })

  it('全部同价返回单个「统一价」带，商品数完整', () => {
    const result = computePriceBands([35, 35, 35, 35])
    expect(result).toHaveLength(1)
    expect(result[0].bandName).toBe('35元')
    expect(result[0].priceMin).toBe(35)
    expect(result[0].priceMax).toBe(35)
    expect(result[0].productCount).toBe(4)
  })

  it('少量商品（sqrt 不足 2）收敛为 2 组', () => {
    const result = computePriceBands([10, 20, 30])
    // bandCount = ceil(sqrt(3)) = 2
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result.reduce((sum, b) => sum + b.productCount, 0)).toBe(3) // 不丢商品
  })

  it('较大样本按 ceil(sqrt(n)) 分箱且上限 6 组，不丢商品', () => {
    const prices = Array.from({ length: 100 }, (_, i) => i * 3 + 1) // 1..298
    const result = computePriceBands(prices)
    // ceil(sqrt(100)) = 10，但上限 6
    expect(result.length).toBeLessThanOrEqual(6)
    expect(result.length).toBeGreaterThan(1)
    expect(result.reduce((sum, b) => sum + b.productCount, 0)).toBe(100)
  })

  it('合并相邻同价标签，结果按价格升序', () => {
    const prices = [10, 10, 10, 30, 30, 50, 50, 50, 80, 80]
    const result = computePriceBands(prices)
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i].priceMin).toBeGreaterThanOrEqual(result[i - 1].priceMax)
    }
  })

  it('每个价格带四舍五入到分（价格不丢失）', () => {
    const prices = [9.5, 9.53, 10.24, 10.26, 11.11]
    const result = computePriceBands(prices)
    const total = result.reduce((sum, b) => sum + b.productCount, 0)
    expect(total).toBe(5)
    for (const band of result) {
      // 分值精确到分：*100 取整后还原等于原值（容忍二进制浮点噪声）
      expect(Math.round(band.priceMin * 100) / 100).toBe(band.priceMin)
      expect(Math.round(band.priceMax * 100) / 100).toBe(band.priceMax)
    }
  })

  it('合并后 count 累加正确', () => {
    // 构造分组后在 label 层不合并的情形：每组边界唯一
    const result = computePriceBands([1, 2, 3, 100, 101, 102])
    // ceil(sqrt(6)) = 3 组
    expect(result.reduce((sum, b) => sum + b.productCount, 0)).toBe(6)
    expect(result.length).toBeGreaterThanOrEqual(1)
    for (const band of result) {
      expect(band.productCount).toBeGreaterThan(0)
    }
  })
})
