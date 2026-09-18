import { AUTO_CHAIN_RULES, parseAutoChainConfig } from './auto-chain'

describe('auto-chain 配置（flow.autoChain 单一来源规则表）', () => {
  it('空白/缺失输入回落默认全关', () => {
    expect(parseAutoChainConfig(null)).toEqual({ analysisToImageGen: false, imageGenToListing: false })
    expect(parseAutoChainConfig(undefined)).toEqual({ analysisToImageGen: false, imageGenToListing: false })
  })

  it('非法 JSON 回落默认全关', () => {
    expect(parseAutoChainConfig('{ not json !!')).toEqual({ analysisToImageGen: false, imageGenToListing: false })
  })

  it('部分配置仅开启对应开关，其余保持默认', () => {
    expect(parseAutoChainConfig('{"analysisToImageGen":true}')).toEqual({
      analysisToImageGen: true,
      imageGenToListing: false,
    })
    expect(parseAutoChainConfig('{"imageGenToListing":true}')).toEqual({
      analysisToImageGen: false,
      imageGenToListing: true,
    })
  })

  it('非布尔值不当作开启', () => {
    expect(parseAutoChainConfig('{"analysisToImageGen":"yes"}').analysisToImageGen).toBe(false)
  })

  it('规则表覆盖当前全部自动链路口径', () => {
    const sources = AUTO_CHAIN_RULES.map((r) => r.sourceType)
    expect(sources).toContain('analysis')
    expect(sources).toContain('image-gen')
    expect(sources).toContain('image_gen')
    expect(new Set(AUTO_CHAIN_RULES.map((r) => r.flagKey))).toEqual(
      new Set(['analysisToImageGen', 'imageGenToListing']),
    )
  })
})