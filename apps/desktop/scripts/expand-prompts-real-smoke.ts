/**
 * 真实模型冒烟：验证 AI 帮写新模板（buildAiHelpWritePrompt）输出 5 段商品信息结构（走查 M6/D1）。
 * 第二参数可传商品信息做商品一致性断言（走查 D1）：输出「商品名称」段必须包含输入商品名关键词。
 * 门禁：最多 3 次真实调用，第 3 次失败退出码非 0 并提示人工确认；不 mock、不伪造成功。
 * 运行：pnpm --filter desktop exec tsx scripts/expand-prompts-real-smoke.ts <userId> [商品信息] [商品名关键词]
 */
import { resolveEffectiveConfig } from '../src/worker/ai-config'
import { createRealAiProvider } from '../src/worker/ai-provider'
import { buildAiHelpWritePrompt } from '../src/worker/image-prompt'

const MAX_ATTEMPTS = 3
const userId = process.argv[2] ?? 'cmu73bfcz000lnrnzr366w1fy'
const productInfo = process.argv[3] ?? '粉色褶皱挂脖宽松长款吊带裙'
const productKeyword = process.argv[4] ?? productInfo.slice(0, 6)

function assert5Segments(text: string): string[] {
  const segments = ['1、商品名称', '2、核心卖点', '3、适用人群', '4、使用场景', '5、规格参数']
  const missing = segments.filter((s) => !text.includes(s))
  if (missing.length) throw new Error(`输出缺少 5 段结构前缀: ${missing.join(', ')}`)
  if (text.includes('{') && text.includes('"prompts"')) throw new Error('输出仍是图位提示词 JSON，非商品信息模板')
  return segments
}

function assertProductConsistent(text: string, keyword: string): void {
  const nameLine = text.split('\n').find((line) => line.startsWith('1、商品名称'))
  if (!nameLine) throw new Error(`商品名称段缺失: ${text.slice(0, 80)}`)
  if (!nameLine.includes(keyword)) throw new Error(`商品名称与实际输入不一致（张冠李戴）: 「${nameLine}」不含「${keyword}」`)
}

async function main() {
  const config = resolveEffectiveConfig(userId)
  if (!config) {
    console.error(`[smoke] 用户 ${userId} 无有效 AI 配置（个人自配或服务端默认均缺），无法执行真实模型验证`)
    process.exit(2)
  }
  console.log(`[smoke] 生效配置: kind=${config.kind} protocol=${config.protocol} textModel=${config.textModel} baseUrl=${config.baseUrl}`)

  const provider = createRealAiProvider(userId)
  const prompt = buildAiHelpWritePrompt({
    settings: { platform: '淘宝', country: '中国', language: '中文', ratio: '1:1' },
    information: productInfo,
  })

  let lastError: unknown = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { text } = await provider.streamText({ prompt, system: '你是电商资深运营，只输出商品信息 5 段结构，不要输出任何解释。', maxTokens: 2000 }, () => undefined)
      const missing = assert5Segments(text)
      assertProductConsistent(text, productKeyword)
      console.log(`[smoke] 第 ${attempt}/${MAX_ATTEMPTS} 次成功，5 段结构齐全: ${missing.join(',')}；商品一致性校验通过（含关键词「${productKeyword}」）`)
      console.log('--- 模型输出预览 ---')
      console.log(text.slice(0, 600))
      console.log('--- 结束 ---')
      process.exit(0)
    } catch (err) {
      lastError = err
      console.error(`[smoke] 第 ${attempt}/${MAX_ATTEMPTS} 次失败: ${err instanceof Error ? err.message : String(err)}`)
      if (attempt === MAX_ATTEMPTS) {
        console.error(`[smoke] 已连续失败 ${MAX_ATTEMPTS} 次，达到门禁上限，停止自动重试，转人工确认。`)
        process.exit(1)
      }
    }
  }
}

main().catch((err) => {
  console.error('[smoke] 未预期错误:', err)
  process.exit(1)
})