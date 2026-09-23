import { randomUUID } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { buildAttemptKey } from '../ai/ai.types'
import { ProviderRouter } from '../ai/provider-router.service'
import { PrismaService } from '../prisma.service'
import {
  buildDetailImagePromptGenerationPrompt,
  buildImagePromptGenerationPrompt,
  buildImageRetouchPromptGenerationPrompt,
  normalizeDetailPromptSlots,
  normalizeGeneratedImagePrompts,
  normalizeRequestedPromptSlots,
  normalizeSelectedSlots,
  parseJsonFromText,
  type PromptSettings,
} from './image-prompt'

export interface GeneratePromptsInput {
  settings?: PromptSettings
  baseText?: string
  reportText?: string
  information?: string
  promptSlots?: unknown[]
  selectedSlots?: unknown[]
}

/** 图生图参考图归一化（对齐旧版 normalizeReferenceImages）：images 数组优先、去重、trim、上限 4 张 */
export function normalizeReferenceImages(image?: string, images?: string[]): string[] {
  const raw = Array.isArray(images) && images.length > 0 ? images : image ? [image] : []
  return Array.from(new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 4)
}

@Injectable()
export class ProductSetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: ProviderRouter,
  ) {}

  async generatePrompts(input: GeneratePromptsInput) {
    const selected = normalizeSelectedSlots(input.selectedSlots ?? [])
    const slots = selected.length ? selected : normalizeRequestedPromptSlots(input.promptSlots ?? [])
    const prompt = buildImagePromptGenerationPrompt({
      settings: input.settings,
      information: input.information,
      designPlan: input.reportText,
      promptSlots: slots,
    })
    const attemptKey = buildAttemptKey({ jobId: 'product-sets', capability: 'text', suffix: 'generate-prompts' })
    const ai = await this.router.execute(
      'text',
      { prompt, system: '只输出 JSON，不要输出多余文字。', maxTokens: 4000 },
      { tenantId: 'local', jobId: 'product-sets', attemptKey },
    )
    const parsed = ai.text ? parseJsonFromText(ai.text) : null
    const prompts = normalizeGeneratedImagePrompts(parsed ?? {}, slots)
    return { ok: true, prompts, model: ai.model }
  }

  async generateImage(input: {
    prompt: string
    size?: string
    count?: number
    jobId?: string
    tenantId: string
    image?: string
    images?: string[]
    ratio?: string
    watermark?: boolean
    name?: string
    slotType?: string
    productName?: string
    productId?: string
    createdBy?: string
  }) {
    const attemptKey = buildAttemptKey({ jobId: input.jobId ?? 'product-sets', capability: 'image', suffix: 'generate' })
    const ai = await this.router.execute(
      'image',
      {
        prompt: input.prompt,
        count: input.count ?? 1,
        size: input.size,
        referenceImageUrls: normalizeReferenceImages(input.image, input.images),
        aspectRatio: input.ratio?.trim() || undefined,
      },
      { tenantId: input.tenantId, jobId: input.jobId ?? 'product-sets', attemptKey },
    )
    const urls = ai.images ?? []
    if (urls.length === 0) {
      // 无真实返回时诚实空态，不伪造 mock 占位图
      return { ok: true, images: [], assetId: null, assetIds: [], jobId: input.jobId ?? null }
    }
    const jobId = input.jobId ?? `product-sets-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // 一批结果逐张登记，避免 count>1 时只落第一张；sourceUrl 保持供应商真实返回。
    const assets = await Promise.all(
      urls.map((url, index) =>
        this.prisma.generatedAsset.create({
          data: {
            tenantId: input.tenantId,
            jobId,
            storageKey: `product-sets/${jobId}/image-${Date.now()}-${index}-${randomUUID().slice(0, 8)}.png`,
            mimeType: url.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
            size: 0,
            sourceUrl: url,
            originalName: input.name ? `${input.name}${urls.length > 1 ? `-${index + 1}` : ''}` : undefined,
            category: input.slotType,
            prompt: input.prompt,
            ratio: input.ratio,
            productName: input.productName || undefined,
            productId: input.productId || undefined,
            createdBy: input.createdBy || undefined,
          },
        }),
      ),
    )
    return {
      ok: true,
      images: urls.map((u) => ({ url: u, dataUrl: u })),
      assetIds: assets.map((asset) => asset.id),
      jobId,
    }
  }

  async listGenerated(tenantId: string, jobId?: string, productName?: string) {
    const rows = await this.prisma.generatedAsset.findMany({
      where: {
        tenantId,
        ...(jobId ? { jobId } : {}),
        ...(productName
          ? { OR: [{ originalName: { contains: productName } }, { productName: { contains: productName } }] }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { storageKey: 'asc' }],
      take: 200,
    })
    return { ok: true, generatedImages: rows }
  }

  async removeGenerated(tenantId: string, id: string) {
    const asset = await this.prisma.generatedAsset.findFirst({ where: { id, tenantId } })
    if (!asset) throw new NotFoundException('图片不存在')
    await this.prisma.generatedAsset.delete({ where: { id } })
    return { ok: true, id }
  }

  /** 5.9 手动保存生成主图（对照旧版 POST /generated-images 的 saveGeneratedMainImages）。 */
  async saveGenerated(
    tenantId: string,
    input: { images?: Array<{ name?: string; url?: string; type?: string }>; productName?: string; productId?: string; sizeRatio?: string; platform?: string; runId?: string; createdBy?: string },
  ) {
    const rows = (input.images ?? []).filter((item) => item && String(item.url || '').trim())
    if (!rows.length) return { ok: true, saved: 0 }
    const assetIds: string[] = []
    for (const item of rows) {
      const url = String(item.url).trim()
      const asset = await this.prisma.generatedAsset.create({
        data: {
          tenantId,
          runId: input.runId || undefined,
          storageKey: `generated-main/${tenantId}/${Date.now()}-${randomUUID().slice(0, 8)}.png`,
          mimeType: url.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png',
          size: 0,
          sourceUrl: url,
          originalName: String(item.name || '').trim() || '生成主图',
          category: String(item.type || '').trim() || undefined,
          ratio: input.sizeRatio || undefined,
          productId: input.productId || undefined,
          productName: input.productName || undefined,
          createdBy: input.createdBy || undefined,
          platform: input.platform || undefined,
        },
      })
      assetIds.push(asset.id)
    }
    return { ok: true, saved: rows.length, assetIds }
  }

  /** 5.9 批量删除生成主图（对照旧版 POST /generated-images/delete 传 ids 数组）。 */
  async removeGeneratedBatch(tenantId: string, ids: string[]) {
    const list = (ids ?? []).filter(Boolean)
    if (!list.length) return { ok: true, deleted: 0 }
    const result = await this.prisma.generatedAsset.deleteMany({ where: { id: { in: list }, tenantId } })
    return { ok: true, deleted: result.count }
  }

  async mainImageDescriptions(runId: string, tenantId?: string) {
    const run = await this.prisma.analysisRun.findFirst({
      where: {
        OR: [{ id: runId }, { jobId: runId }, { reportNo: runId }],
        ...(tenantId ? { tenantId } : {}),
      },
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

  /** 详情图（APlus）工作流：按模块顺序生成提示词 */
  async generateDetailWorkflow(input: { settings?: PromptSettings; baseText?: string; reportText?: string; promptSlots?: unknown[] }) {
    const slots = normalizeDetailPromptSlots(input.promptSlots ?? [])
    const prompt = buildDetailImagePromptGenerationPrompt({
      settings: input.settings,
      information: input.baseText,
      designPlan: input.reportText,
      promptSlots: slots,
    })
    const attemptKey = buildAttemptKey({ jobId: 'product-sets', capability: 'text', suffix: 'detail-workflow' })
    const ai = await this.router.execute(
      'text',
      { prompt, system: '只输出 JSON，不要输出多余文字。', maxTokens: 4000 },
      { tenantId: 'local', jobId: 'product-sets', attemptKey },
    )
    const parsed = ai.text ? parseJsonFromText(ai.text) : null
    const detailWorkflowPrompt = normalizeGeneratedImagePrompts(parsed ?? {}, slots)
    return { ok: true, data: detailWorkflowPrompt, detailStrategyPlan: parsed, model: ai.model }
  }

  /** 改图：根据用户方向重写某图位的提示词 */
  async generateRetouchPrompt(input: { settings?: PromptSettings; slot?: Record<string, unknown>; originalPrompt?: string; userDirection?: string }) {
    const prompt = buildImageRetouchPromptGenerationPrompt({
      settings: input.settings,
      slot: input.slot,
      originalPrompt: input.originalPrompt,
      userDirection: input.userDirection,
    })
    const attemptKey = buildAttemptKey({ jobId: 'product-sets', capability: 'text', suffix: 'retouch' })
    const ai = await this.router.execute(
      'text',
      { prompt, system: '你是电商主图改图提示词助手。', maxTokens: 2000 },
      { tenantId: 'local', jobId: 'product-sets', attemptKey },
    )
    return { ok: true, prompt: ai.text ?? prompt, model: ai.model }
  }

  /** OCR：提取图片文字（走视觉能力，Mock 下返回占位） */
  async extractImageText(input: { imageUrl: string; tenantId: string }) {
    if (!input.imageUrl.trim()) throw new BadRequestException('imageUrl 不能为空')
    const attemptKey = buildAttemptKey({ jobId: 'product-sets', capability: 'vision', suffix: 'ocr' })
    const ai = await this.router.execute(
      'vision',
      { prompt: '请提取这张图片中的所有文字，原样输出。', images: [input.imageUrl], maxTokens: 1500 },
      { tenantId: input.tenantId, jobId: 'product-sets', attemptKey },
    )
    return { ok: true, text: ai.text ?? '', model: ai.model }
  }

  /** AI 帮写提示词（SSE 流式数据源） */
  async expandPrompts(input: GeneratePromptsInput) {
    const selected = normalizeSelectedSlots(input.selectedSlots ?? [])
    const slots = selected.length ? selected : normalizeRequestedPromptSlots(input.promptSlots ?? [])
    const prompt = buildImagePromptGenerationPrompt({
      settings: input.settings,
      information: input.information,
      designPlan: input.reportText,
      promptSlots: slots,
    })
    const attemptKey = buildAttemptKey({ jobId: 'product-sets', capability: 'text', suffix: 'expand-stream' })
    const ai = await this.router.execute(
      'text',
      { prompt, system: '你是电商主图提示词策划，请输出详细可执行的各图位提示词。', maxTokens: 3000 },
      { tenantId: 'local', jobId: 'product-sets', attemptKey },
    )
    return { text: ai.text ?? '', model: ai.model }
  }
}
