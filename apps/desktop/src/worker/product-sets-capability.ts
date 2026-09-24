import { createRealAiProvider, type StreamEvent } from './ai-provider'
import {
  buildImagePromptGenerationPrompt,
  buildImageRetouchPromptGenerationPrompt,
  normalizeGeneratedImagePrompts,
  normalizeRequestedPromptSlots,
  normalizeSelectedSlots,
  parseJsonFromText,
  type PromptSettings,
} from './image-prompt'
import { getWorkerPrisma } from './worker-db'

export interface ProductSetsInput {
  userId: string
  settings?: PromptSettings
  baseText?: string
  reportText?: string
  information?: string
  promptSlots?: unknown[]
  selectedSlots?: unknown[]
}

/** 主图提示词生成（text）。对齐后端 product-sets.generatePrompts。 */
export async function generatePrompts(input: ProductSetsInput) {
  const selected = normalizeSelectedSlots(input.selectedSlots ?? [])
  const slots = selected.length ? selected : normalizeRequestedPromptSlots(input.promptSlots ?? [])
  const prompt = buildImagePromptGenerationPrompt({
    settings: input.settings,
    information: input.information,
    designPlan: input.reportText,
    promptSlots: slots,
  })
  const ai = await createRealAiProvider(input.userId).generateText({ prompt, system: '只输出 JSON，不要输出多余文字。', maxTokens: 4000 })
  const parsed = ai.text ? parseJsonFromText(ai.text) : null
  const prompts = normalizeGeneratedImagePrompts(parsed ?? {}, slots)
  return { ok: true, prompts, model: ai.model }
}

/** AI 帮写提示词（text）。对齐后端 expandPrompts；经 IPC 事件流逐块下发。 */
export async function expandPrompts(input: ProductSetsInput, emit: (event: StreamEvent) => void) {
  const selected = normalizeSelectedSlots(input.selectedSlots ?? [])
  const slots = selected.length ? selected : normalizeRequestedPromptSlots(input.promptSlots ?? [])
  const prompt = buildImagePromptGenerationPrompt({
    settings: input.settings,
    information: input.information,
    designPlan: input.reportText,
    promptSlots: slots,
  })
  const provider = createRealAiProvider(input.userId)
  const ai = await provider.streamText({ prompt, system: '你是电商主图提示词策划，请输出详细可执行的各图位提示词。', maxTokens: 3000 }, emit)
  emit({ type: 'done', text: ai.text, data: { content: ai.text, model: ai.model } })
  return { text: ai.text, model: ai.model }
}

/** AI 改图提示词（text）。对齐后端 generateRetouchPrompt（返回模型原文作为 prompt）。 */
export async function generateRetouchPrompt(input: { userId: string; settings?: PromptSettings; slot?: { name?: string; type?: string }; originalPrompt?: string; userDirection?: string }) {
  const prompt = buildImageRetouchPromptGenerationPrompt({
    settings: input.settings,
    slot: input.slot,
    originalPrompt: input.originalPrompt,
    userDirection: input.userDirection,
  })
  const ai = await createRealAiProvider(input.userId).generateText({ prompt, system: '你是电商主图改图提示词助手。', maxTokens: 2000 })
  return { ok: true, prompt: ai.text ?? prompt, model: ai.model }
}

// ── 详情图（APlus）工作流：后端 product-sets.generate-detail-workflow 迁入。
// 桌面端不打包 guidelines spec，故各模块规则直接用兜底口径（与后端缺失 spec 时一致）。

const DETAIL_MODULE_ORDER = [
  '首屏主视觉',
  '核心卖点图',
  '使用场景图',
  '多角度图',
  '场景氛围图',
  '商品细节图',
  '品牌故事图',
  '尺寸/容量/尺码图',
  '效果对比图',
  '详细规格/参数表',
  '工艺制作图',
  '配件/赠品图',
  '系列展示图',
  '商品成分图',
  '售后保障图',
  '使用建议图',
]

export interface DetailPromptSlot {
  id: string
  name: string
  type: string
  sequence: number
}

/** 归一化详情图模块类型（容忍斜杠/下划线/空格差异）。 */
function normalizeDetailModuleType(type: string): string {
  const cleanType = String(type ?? '').trim()
  if (DETAIL_MODULE_ORDER.includes(cleanType)) return cleanType
  const normalized = cleanType.replace(/[／]/g, '/').replace(/_/g, '/').replace(/\s+/g, '')
  return DETAIL_MODULE_ORDER.find((item) => item.replace(/\s+/g, '') === normalized) ?? ''
}

/** 归一化请求的详情图模块（按 DETAIL_MODULE_ORDER 顺序返回）。 */
function normalizeDetailPromptSlots(promptSlots: unknown[]): DetailPromptSlot[] {
  const allowedTypes = new Set(DETAIL_MODULE_ORDER)
  const seen = new Set<string>()
  const requested = (Array.isArray(promptSlots) ? promptSlots : [])
    .map((item, index) => {
      const record = (item ?? {}) as Record<string, unknown>
      const rawType = typeof item === 'string' ? item : record.type ?? record.name
      const type = normalizeDetailModuleType(String(rawType ?? ''))
      if (!allowedTypes.has(type) || seen.has(type)) return null
      seen.add(type)
      const sequence = Number.isFinite(Number(record.sequence)) ? Number(record.sequence) : index + 1
      return {
        id: String(record.id ?? `detail-${sequence}-${type}`).trim(),
        name: String(record.name ?? `${String(sequence).padStart(2, '0')} ${type}`).trim(),
        type,
        sequence,
      } as DetailPromptSlot
    })
    .filter((slot): slot is DetailPromptSlot => slot !== null)
  return DETAIL_MODULE_ORDER.map((type) => requested.find((slot) => slot.type === type)).filter(
    (slot): slot is DetailPromptSlot => Boolean(slot),
  )
}

/** 详情图工作流第4步：生成各模块完整生图提示词（对齐后端 buildDetailImagePromptGenerationPrompt）。 */
function buildDetailImagePromptGenerationPrompt(options: { settings?: PromptSettings; information?: string; designPlan?: string; promptSlots: DetailPromptSlot[] }): string {
  const schema = options.promptSlots.map((slot) => ({
    id: slot.id,
    name: slot.name,
    type: slot.type,
    prompt: '完整详情图生图提示词',
  }))
  const slotList = options.promptSlots.map((slot, index) => `${index + 1}. ${slot.name}：${slot.type}`).join('\n')
  const typeRules = options.promptSlots
    .map((slot) => `【${slot.name}｜${slot.type}】\n按该详情图模块规划输出一段可直接用于生图的最终提示词。`)
    .join('\n\n')

  return `你正在执行商品详情图生成工作流第4步：根据详情页设计规划生成各模块完整生图提示词。

【信息整理补全】
${String(options.information ?? '').trim()}

【详情页设计规划】
${String(options.designPlan ?? '').trim()}

【页面设置】
目标平台：${options.settings?.platform || '电商平台'}
销售地区：${options.settings?.country || '中国'}
画面语种：${options.settings?.language || '中文'}
输出比例：${options.settings?.ratio || '1:1'}

【需要生成提示词的模块】
${slotList}

【各模块生图提示词规范】
${typeRules}

【总规则】
1. 只输出“需要生成提示词的模块”，数量、id、name、type 必须与输入完全一致。
2. 每个 prompt 必须基于《信息整理补全》、对应模块的《详情页设计规划》和该模块规范生成。
3. 每个 prompt 必须明确：商品必须严格参考用户上传产品图，保持颜色、材质、结构比例、纹理、轮廓、包装/标签和关键设计特征一致。
4. 每个 prompt 必须包含该模块规范要求保留的字段结构，例如[第1屏]、[氛围/风格]、[元素布局]、[光影质感]、[配色色系]、[视角构图]、[文字版式]、[比例分辨率]。
5. 同一套详情图必须保持统一全局视觉系统，但不同模块不得重复同一构图、同一角度、同一文案或同一利益点。
6. 画面文字必须短、清楚、移动端可读，并严格使用页面语种。
7. 不得编造价格、折扣、赠品、认证、检测报告、销量、平台背书、绝对化表达、联系方式、二维码、水印或其他品牌标识。
8. 每条 prompt 输出为中文自然段，约400字以上，可直接用于图生图。

【输出格式】
必须只输出 JSON，不要使用 Markdown，不要输出解释或分析过程。
{
  "prompts": ${JSON.stringify(schema, null, 2)}
}`
}

/** 详情图（APlus）工作流：按模块顺序生成提示词。对齐后端 generateDetailWorkflow。 */
export async function generateDetailWorkflow(input: { userId: string; settings?: PromptSettings; baseText?: string; reportText?: string; promptSlots?: unknown[] }) {
  const slots = normalizeDetailPromptSlots(input.promptSlots ?? [])
  const prompt = buildDetailImagePromptGenerationPrompt({
    settings: input.settings,
    information: input.baseText,
    designPlan: input.reportText,
    promptSlots: slots,
  })
  const ai = await createRealAiProvider(input.userId).generateText({ prompt, system: '只输出 JSON，不要输出多余文字。', maxTokens: 4000 })
  const parsed = ai.text ? parseJsonFromText(ai.text) : null
  const detailWorkflowPrompt = normalizeGeneratedImagePrompts(parsed ?? {}, slots)
  return { ok: true, data: detailWorkflowPrompt, detailStrategyPlan: parsed, model: ai.model }
}

/** OCR（vision）：提取图片文字。 */
export async function extractImageText(input: { userId: string; imageUrl: string }) {
  if (!input.imageUrl.trim()) throw new Error('imageUrl 不能为空')
  const ai = await createRealAiProvider(input.userId).analyzeImage({
    prompt: '请提取这张图片中的所有文字，原样输出。',
    images: [input.imageUrl],
    maxTokens: 1500,
  })
  return { ok: true, text: ai.text ?? '', model: ai.model }
}

/** 主图描述：读本地 AnalysisRun.reportJson 生成设计输入（对齐后端 mainImageDescriptions）。 */
export async function mainImageDescriptions(runId: string) {
  const db = getWorkerPrisma()
  const run = await db.analysisRun.findFirst({
    where: { OR: [{ id: runId }, { jobId: runId }, { reportNo: runId }] },
  })
  const reportJson = (run?.reportJson ?? null) as {
    summary?: string
    sellingPoints?: Array<{ term?: string; count?: number }>
    painPoints?: string[]
    userDemands?: string[]
    opportunities?: string[]
  } | null
  const sellingPoints = reportJson?.sellingPoints?.map((item) => String(item?.term ?? '').trim()).filter(Boolean) ?? []
  const promptParts = [
    reportJson?.summary,
    sellingPoints.length ? `核心卖点：${sellingPoints.join('、')}` : '',
    reportJson?.painPoints?.length ? `规避痛点：${reportJson.painPoints.join('、')}` : '',
    reportJson?.userDemands?.length ? `满足需求：${reportJson.userDemands.join('、')}` : '',
    reportJson?.opportunities?.length ? `机会方向：${reportJson.opportunities.join('、')}` : '',
  ].filter(Boolean)
  return {
    ok: true,
    source: run ? 'ai' : 'none',
    summary: reportJson?.summary ?? null,
    sellingPoints,
    painPoints: reportJson?.painPoints ?? [],
    userDemands: reportJson?.userDemands ?? [],
    opportunities: reportJson?.opportunities ?? [],
    promptText: promptParts.join('\n'),
  }
}
