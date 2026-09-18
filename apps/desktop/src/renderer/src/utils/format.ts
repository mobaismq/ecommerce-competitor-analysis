/**
 * 电商数据呈现通用格式化工具函数
 */
import dayjs from 'dayjs'

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

/** 统一的时间展示格式（含日期与时分秒） */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss'
/** 统一的时间展示格式（仅时分秒） */
const TIME_FMT = 'HH:mm:ss'

/**
 * 格式化日期时间；解析失败或空值返回 fallback（默认 '-')
 * @param value 时间字符串 / 时间戳 / Date，或空值
 */
export function formatDateTime(value: string | number | Date | null | undefined, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback
  const d = dayjs(value)
  return d.isValid() ? d.format(DATETIME_FMT) : fallback
}

/**
 * 格式化仅时间（HH:mm:ss）；解析失败或空值返回 fallback（默认 '-'）
 */
export function formatTime(value: string | number | Date | null | undefined, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback
  const d = dayjs(value)
  return d.isValid() ? d.format(TIME_FMT) : fallback
}
