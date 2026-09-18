import { QUEUE_NAMES } from './queue-names'

export interface AutoChainConfig {
  analysisToImageGen: boolean
  imageGenToListing: boolean
}

/**
 * 单一来源的链式规则表：源任务类型 → 下游任务（类型 + 目标队列 + 开关项）。
 * 新增一条自动链路 = 在数组中追加一行，并在 AutoChainConfig 增加一个布尔开关，无需改动 maybeChain。
 */
export interface AutoChainRule {
  sourceType: string
  targetType: string
  targetQueue: string
  flagKey: keyof AutoChainConfig
}

export const AUTO_CHAIN_RULES: AutoChainRule[] = [
  {
    sourceType: 'analysis',
    targetType: 'image-gen',
    targetQueue: QUEUE_NAMES.serverImageGen,
    flagKey: 'analysisToImageGen',
  },
  {
    sourceType: 'image-gen',
    targetType: 'listing',
    targetQueue: QUEUE_NAMES.serverListing,
    flagKey: 'imageGenToListing',
  },
  {
    sourceType: 'image_gen',
    targetType: 'listing',
    targetQueue: QUEUE_NAMES.serverListing,
    flagKey: 'imageGenToListing',
  },
]

const DEFAULT_AUTO_CHAIN_CONFIG: AutoChainConfig = {
  analysisToImageGen: false,
  imageGenToListing: false,
}

/**
 * 把 systemConfig 中的 `flow.autoChain` JSON 字符串解析为受校验的类型化配置。
 * 非法/缺失输入一律回落默认关闭，杜绝裸 JSON.parse 对脏配置的不可控透传。
 */
export function parseAutoChainConfig(raw: string | null | undefined): AutoChainConfig {
  if (!raw) return { ...DEFAULT_AUTO_CHAIN_CONFIG }
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof AutoChainConfig, unknown>>
    return {
      analysisToImageGen: parsed.analysisToImageGen === true,
      imageGenToListing: parsed.imageGenToListing === true,
    }
  } catch {
    return { ...DEFAULT_AUTO_CHAIN_CONFIG }
  }
}