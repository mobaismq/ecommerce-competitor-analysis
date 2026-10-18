import { describe, expect, it } from 'vitest'
import { buildAiHelpWritePrompt } from './image-prompt'

describe('buildAiHelpWritePrompt（AI 帮写商品信息模板，走查 M6/D1）', () => {
  it('输出包含固定 5 段结构', () => {
    const prompt = buildAiHelpWritePrompt({
      settings: { platform: '淘宝', country: '中国', language: '中文', ratio: '1:1' },
      information: '粉色褶皱挂脖宽松长款吊带裙',
    })
    expect(prompt).toContain('1.产品名称')
    expect(prompt).toContain('2.核心卖点')
    expect(prompt).toContain('3.适用人群')
    expect(prompt).toContain('4.期望场景')
    expect(prompt).toContain('5.具体参数')
  })

  it('以商品图为事实来源，用户内容仅作为不冲突的补充', () => {
    const prompt = buildAiHelpWritePrompt({ settings: {}, information: '' })
    expect(prompt).toContain('商品图是必填且最高优先级的事实来源')
    expect(prompt).toContain('用户已填写内容是可选补充')
    expect(prompt).toContain('以商品原图为准')
    expect(prompt).toContain('不得替换商品')
    expect(prompt).toContain('不得虚构')
  })

  it('信息为空时要求仅根据商品图整理', () => {
    const prompt = buildAiHelpWritePrompt({ settings: {}, information: '   ' })
    expect(prompt).toContain('用户未填写内容')
    expect(prompt).toContain('只能根据商品原图中可见信息整理')
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
