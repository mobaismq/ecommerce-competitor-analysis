import { describe, expect, it } from 'vitest'
import { parseRpaProgress } from './rpaProgress'

describe('parseRpaProgress', () => {
  it('当日志为空时返回等待状态', () => {
    const result = parseRpaProgress('', 100)
    expect(result.label).toBe('等待开始')
    expect(result.current).toBeNull()
    expect(result.total).toBe(100)
    expect(result.percent).toBeNull()
    expect(result.detail).toBe('等待脚本写入进度')
  })

  it('能正确提取批次商品进度', () => {
    const log = `
[INFO] 开始采集
=== batch item 1/50
[INFO] 下载成功
=== batch item 25/50
`
    const result = parseRpaProgress(log)
    expect(result.current).toBe(25)
    expect(result.total).toBe(50)
    expect(result.percent).toBe(50)
    expect(result.label).toBe('下载导出')
    expect(result.detail).toBe('正在处理第 25/50 个商品')
  })

  it('能识别冷却等待阶段', () => {
    const log = `
=== batch item 10/100
{"status": "waiting", "reason": "cooldown", "seconds": 20}
`
    const result = parseRpaProgress(log, 100)
    expect(result.label).toBe('冷却等待')
    expect(result.current).toBe(10)
  })

  it('能识别清洗入库阶段', () => {
    const log = `
=== batch item 50/50
=== mysql import
[INFO] 正在导入数据库
`
    const result = parseRpaProgress(log, 50)
    expect(result.label).toBe('清洗入库')
  })

  it('能识别批次汇总与报告阶段', () => {
    const log = `
=== batch item 50/50
=== batch summary
=== market analysis
`
    const result = parseRpaProgress(log, 50)
    expect(result.label).toBe('分析报告')
    expect(result.percent).toBe(100)
  })
})
