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
