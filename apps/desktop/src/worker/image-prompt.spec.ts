import { describe, expect, it } from 'vitest'
import { buildAiHelpWritePrompt } from './image-prompt'

describe('buildAiHelpWritePrompt（AI 帮写商品信息模板，走查 M6/D1）', () => {
  it('输出包含 5 段结构且每段以「数字、」开头', () => {
    const prompt = buildAiHelpWritePrompt({
      settings: { platform: '淘宝', country: '中国', language: '中文', ratio: '1:1' },
      information: '粉色褶皱挂脖宽松长款吊带裙',
    })
    expect(prompt).toContain('1、商品名称')
    expect(prompt).toContain('2、核心卖点')
    expect(prompt).toContain('3、适用人群')
    expect(prompt).toContain('4、使用场景')
    expect(prompt).toContain('5、规格参数')
  })

  it('强制以商品原图为唯一事实依据（修复 D1 商品一致性）', () => {
    const prompt = buildAiHelpWritePrompt({ settings: {}, information: '' })
    expect(prompt).toContain('用户上传的商品原图为唯一事实依据')
    expect(prompt).toContain('不得替换商品')
    expect(prompt).toContain('不得虚构')
  })

  it('信息为空时兜底「以用户上传商品原图中可见信息为准」', () => {
    const prompt = buildAiHelpWritePrompt({ settings: {}, information: '   ' })
    expect(prompt).toContain('以用户上传商品原图中可见信息为准')
  })

  it('页面设置缺省有兜底值', () => {
    const prompt = buildAiHelpWritePrompt({ settings: {} })
    expect(prompt).toContain('目标平台：电商平台')
    expect(prompt).toContain('页面语言：中文')
  })

  it('不要求输出 JSON（区别于图位提示词模板）', () => {
    const prompt = buildAiHelpWritePrompt({ settings: {}, information: 'x' })
    expect(prompt).not.toContain('"prompts"')
    expect(prompt).not.toContain('只输出 JSON')
  })
})