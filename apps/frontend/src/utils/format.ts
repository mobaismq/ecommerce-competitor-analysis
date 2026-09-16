/**
 * 电商数据呈现通用格式化工具函数
 */

/**
 * 格式化金额（元）
 * @param amount 金额数值或字符串
 * @param decimals 保留小数位数，默认 2
 */
export function formatCurrency(amount: number | string | null | undefined, decimals = 2): string {
  if (amount === null || amount === undefined || amount === '') return '¥0.00'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '¥0.00'
  return `¥${num.toFixed(decimals)}`
}

/**
 * 格式化百分比
 * @param ratio 比率（如 0.156 代表 15.6%）
 * @param decimals 小数位数，默认 1
 */
export function formatPercent(ratio: number | null | undefined, decimals = 1): string {
  if (ratio === null || ratio === undefined || isNaN(ratio)) return '0.0%'
  return `${(ratio * 100).toFixed(decimals)}%`
}

/**
 * 文本截断加省略号
 */
export function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}...`
}

/**
 * 销量/大数字简写 (例如 12500 -> 1.25万)
 */
export function formatCompactNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0'
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}万`
  }
  return String(num)
}
