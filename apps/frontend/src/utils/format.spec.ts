import { describe, expect, it } from 'vitest'
import { formatCompactNumber, formatCurrency, formatPercent, truncate } from './format'

describe('Format Utilities', () => {
  describe('formatCurrency', () => {
    it('正确格式化常规数值', () => {
      expect(formatCurrency(99.9)).toBe('¥99.90')
      expect(formatCurrency(100)).toBe('¥100.00')
      expect(formatCurrency('25.5')).toBe('¥25.50')
    })

    it('处理边界与空值', () => {
      expect(formatCurrency(null)).toBe('¥0.00')
      expect(formatCurrency(undefined)).toBe('¥0.00')
      expect(formatCurrency('')).toBe('¥0.00')
      expect(formatCurrency('invalid')).toBe('¥0.00')
    })
  })

  describe('formatPercent', () => {
    it('正确格式化比率', () => {
      expect(formatPercent(0.1234)).toBe('12.3%')
      expect(formatPercent(0.5, 0)).toBe('50%')
      expect(formatPercent(1)).toBe('100.0%')
    })

    it('处理无效比率', () => {
      expect(formatPercent(null)).toBe('0.0%')
      expect(formatPercent(NaN)).toBe('0.0%')
    })
  })

  describe('truncate', () => {
    it('超出长度时截断并追加省略号', () => {
      expect(truncate('这是一个很长很长的电商商品标题测试', 6)).toBe('这是一个很长...')
    })

    it('未超出长度时原样返回', () => {
      expect(truncate('短标题', 10)).toBe('短标题')
    })

    it('空字符串与 null 安全返回', () => {
      expect(truncate('', 5)).toBe('')
      expect(truncate(null, 5)).toBe('')
    })
  })

  describe('formatCompactNumber', () => {
    it('小于一万时直接返回数字字符串', () => {
      expect(formatCompactNumber(999)).toBe('999')
      expect(formatCompactNumber(9999)).toBe('9999')
    })

    it('大于等于一万时转换为万单位', () => {
      expect(formatCompactNumber(10000)).toBe('1万')
      expect(formatCompactNumber(12500)).toBe('1.3万')
      expect(formatCompactNumber(50000)).toBe('5万')
    })
  })
})
