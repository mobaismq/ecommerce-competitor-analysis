// 竞品报告价格带计算（迁移自旧 `apps/legacy/src/server/aiMarketAnalysis.js` buildPriceBands）。
// 旧实现采用「自适应等频分箱」：按价格排序后等量切分为 ceil(sqrt(n)) 组（上限 6），
// 每组商品数量大致相等，再合并相同价格标签的相邻带。相比等宽分带，它对偏态/稀疏价格分布更稳健。
// 纯函数，不依赖数据库，便于单元测试。

export interface PriceBand {
  bandName: string
  priceMin: number
  priceMax: number
  productCount: number
}

/** 四舍五入到分，保持与旧 money() 一致。 */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

/** 排序去重后参与分箱的价格数组（已过滤非法值）。 */
function normalizePrices(prices: readonly number[]): number[] {
  return prices.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
}

/**
 * 计算价格带（自适应等频分箱）。
 * @param prices 商品价格列表（可为空/含非法值）。
 * @returns 升序的价格带数组；无有效价格时返回空数组；全部同价时返回单个「统一价」带。
 */
export function computePriceBands(prices: readonly number[]): PriceBand[] {
  const priced = normalizePrices(prices)
  if (priced.length === 0) return []
  const min = priced[0]
  const max = priced[priced.length - 1]
  if (min === max) return [{ bandName: `${min}元`, priceMin: min, priceMax: max, productCount: priced.length }]

  const bandCount = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(priced.length))))

  // 等频分组：按索引均分，每组商品数基本相等。
  const groups: number[][] = []
  for (let index = 0; index < bandCount; index += 1) {
    const start = Math.floor((index * priced.length) / bandCount)
    const end = Math.floor(((index + 1) * priced.length) / bandCount)
    const items = priced.slice(start, end)
    if (items.length > 0) groups.push(items)
  }

  // 合并相邻同价标签（如多组共享同一 min-max 边界），保持旧标签格式。
  const merged = new Map<string, { min: number; max: number; count: number }>()
  for (const items of groups) {
    const lo = roundCents(Math.min(...items))
    const hi = roundCents(Math.max(...items))
    const key = lo === hi ? `${lo}元` : `${lo}-${hi}元`
    const current = merged.get(key) ?? { min: lo, max: hi, count: 0 }
    current.min = Math.min(current.min, lo)
    current.max = Math.max(current.max, hi)
    current.count += items.length
    merged.set(key, current)
  }

  return Array.from(merged.entries()).map(([bandName, band]) => ({
    bandName,
    priceMin: band.min,
    priceMax: band.max,
    productCount: band.count,
  }))
}
