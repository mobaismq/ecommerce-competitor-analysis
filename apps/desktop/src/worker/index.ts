import type { CapabilityInvokeMessage, WorkerOutbound } from './protocol'
import { isInvoke } from './protocol'
import { getWorkerPrisma, putBytes, removeBytes, workerDataRoots } from './worker-db'
import { generateImageCapability, type GenerateImageInput } from './image-capability'
import { listAssets, rawAsset, deleteAsset } from './asset-capability'
import { deleteMedia, listMedia, mediaRaw, replicateVideo } from './media-capability'
import {
  getCategories as getPlatformCategories,
  getStatus as getPlatformStatus,
  listAdapterCodes as listPlatformAdapterCodes,
  listProducts as listPlatformProducts,
  publishListing,
  rawListingMedia as getPlatformMediaRaw,
  removeListingMedia,
  saveListingDraft,
  uploadListingMedia,
  type ListProductsInput,
} from './platform-capability'
import { expandPrompts, extractImageText, generateDetailWorkflow, generatePrompts, generateRetouchPrompt, mainImageDescriptions, type ProductSetsInput } from './product-sets-capability'
import { PrismaCheckpointSaver } from './checkpoint-saver'
import { runProductSetGraph, type GenerationSlotGraph } from './product-sets-graph'
import { runDetailGraph, type DetailModuleGraph } from './detail-graph'
import { getSelfConfig, saveSelfConfig, setServerDefault, type SaveSelfConfigInput } from './ai-config'
import { cancelAnalysisJob, createAnalysisJob, getAnalysisJob, type CreateAnalysisJobInput } from './analysis-capability'
import { createProduct, deleteProduct, listProducts, updateProduct, type SaveProductInput } from './product-capability'
import {
  dataAgentChat,
  dataAgentDatasets,
  exportReport,
  generateReport,
  getMainImageAnalysis,
  getReport,
  latestReport,
  listReportJobs,
  listReports,
  priceBandsPreview,
  rerunBandAnalysis,
  reportProducts,
  runMainImageAnalysis,
  type GenerateReportInput,
  type ReportExportFormat,
} from './report-capability'

export interface WorkerHost {
  postMessage: (message: WorkerOutbound) => void
  onMessage: (handler: (msg: unknown) => void) => void
  pid?: number
}

export type CapabilityHandler = (payload: unknown, ctx?: { emit: (event: { type: string; text?: string; data?: Record<string, unknown> }) => void }) => Promise<unknown> | unknown

/** worker 侧路由：ready → ack → stream/result/error。未知能力走诚实错误，不伪造成功。 */
export function startWorkerRuntime(host: WorkerHost, handlers: Record<string, CapabilityHandler>) {
  host.onMessage(async (raw) => {
    if (!isInvoke(raw)) return
    const msg = raw as CapabilityInvokeMessage
    host.postMessage({ type: 'capability-ack', msgId: msg.msgId, capability: msg.capability })
    const handler = handlers[msg.capability]
    if (!handler) {
      host.postMessage({
        type: 'capability-error',
        msgId: msg.msgId,
        capability: msg.capability,
        error: { code: 'CAPABILITY_NOT_CONFIGURED', message: `能力「${msg.capability}」尚未接入` },
      })
      return
    }
    try {
      const emit = (event: { type: string; text?: string; data?: Record<string, unknown> }) =>
        host.postMessage({ type: 'capability-stream', msgId: msg.msgId, capability: msg.capability, event })
      const result = await handler(msg.payload, { emit })
      host.postMessage({ type: 'capability-result', msgId: msg.msgId, capability: msg.capability, result })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = (error as { code?: string })?.code || 'CAPABILITY_FAILED'
      host.postMessage({ type: 'capability-error', msgId: msg.msgId, capability: msg.capability, error: { code, message } })
    }
  })
  host.postMessage({ type: 'worker-ready', pid: host.pid })
}

export function createBuiltinHandlers(): Record<string, CapabilityHandler> {
  return {
    ping: async () => ({ ok: true, at: new Date().toISOString() }),
    // 落库+落盘冒烟：写一条能力记录与一个本地文件，读回后立即清理
    'storage.smoke': async () => {
      const db = getWorkerPrisma()
      const id = `smoke-${Date.now()}`
      const roots = workerDataRoots()
      const rel = `tmp/smoke/${id}.txt`
      const full = putBytes(rel, Buffer.from('smoke'), { userRoot: roots.userRoot })
      await db.generatedAsset.create({ data: { id, tenantId: 't-smoke', storageKey: rel, mimeType: 'text/plain', size: 5 } })
      const found = await db.generatedAsset.findUnique({ where: { id } })
      await db.generatedAsset.delete({ where: { id } })
      removeBytes(full)
      return { ok: !!found, storageKey: rel }
    },
    'image.generate': async (payload) => {
      const roots = workerDataRoots()
      return generateImageCapability(payload as GenerateImageInput, undefined, roots.userRoot)
    },
    'asset.list': async (payload) => listAssets(undefined, String((payload as { jobId?: string })?.jobId ?? undefined)),
    'asset.raw': async (payload) => rawAsset(String((payload as { id?: string })?.id ?? '')),
    'asset.delete': async (payload) => deleteAsset(String((payload as { id?: string })?.id ?? '')),
    'media.list': async (payload) => listMedia({ tenantId: String((payload as { tenantId?: string })?.tenantId ?? '') }),
    'media.raw': async (payload) => mediaRaw({ id: String((payload as { id?: string })?.id ?? ''), tenantId: String((payload as { tenantId?: string })?.tenantId ?? '') }),
    'media.delete': async (payload) => deleteMedia({ id: String((payload as { id?: string })?.id ?? ''), tenantId: String((payload as { tenantId?: string })?.tenantId ?? '') }),
    'video.replicate': async (payload) => replicateVideo({ tenantId: String((payload as { tenantId?: string })?.tenantId ?? ''), sourceUrl: (payload as { sourceUrl?: string })?.sourceUrl, sourceStorageKey: (payload as { sourceStorageKey?: string })?.sourceStorageKey, title: (payload as { title?: string })?.title }),
    'platform.adapterCodes': async () => listPlatformAdapterCodes(),
    'platform.status': async (payload) => getPlatformStatus(String((payload as { code?: string })?.code ?? 'taobao')),
    'platform.categories': async (payload) => getPlatformCategories(String((payload as { code?: string })?.code ?? 'taobao'), String((payload as { parentId?: string })?.parentId ?? '0')),
    'platform.mediaUpload': async (payload) => uploadListingMedia({ buffer: (payload as { buffer?: Uint8Array })?.buffer ?? new Uint8Array(), tenantId: (payload as { tenantId?: string })?.tenantId, kind: (payload as { kind?: string })?.kind, contentType: (payload as { contentType?: string })?.contentType, originalName: (payload as { originalName?: string })?.originalName }),
    'platform.mediaRaw': async (payload) => getPlatformMediaRaw(String((payload as { storageKey?: string })?.storageKey ?? '')),
    'platform.mediaDelete': async (payload) => removeListingMedia((payload as { keys?: string[] })?.keys ?? []),
    'platform.draft': async (payload) => saveListingDraft(payload as Parameters<typeof saveListingDraft>[0]),
    'platform.publish': async (payload) => publishListing(payload as Parameters<typeof publishListing>[0]),
    'platform.listProducts': async (payload) => listPlatformProducts(payload as ListProductsInput),
    'productSets.generatePrompts': async (payload) => generatePrompts(payload as ProductSetsInput),
    'productSets.generateDetailWorkflow': async (payload) => generateDetailWorkflow(payload as Parameters<typeof generateDetailWorkflow>[0]),
    'productSets.expandPrompts': async (payload, ctx) => expandPrompts(payload as ProductSetsInput, (event) => ctx?.emit(event)),
    'productSets.generateRetouchPrompt': async (payload) => generateRetouchPrompt(payload as Parameters<typeof generateRetouchPrompt>[0]),
    'productSets.extractImageText': async (payload) => extractImageText(payload as { userId: string; imageUrl: string }),
    'productSets.mainImageDescriptions': async (payload) => mainImageDescriptions(String((payload as { runId?: string })?.runId ?? '')),
    // LangGraph 编排的商品主图套图生成：planPrompts → Send 扇出逐图 generateOne，checkpoint 落本地 SQLite。
    // 流式经 ctx.emit 转发节点级进度（node:planPrompts / node:generateImage / done）。
    'productSets.graph.run': async (payload, ctx) => {
      const roots = workerDataRoots()
      const p = payload as {
        userId: string
        tenantId?: string
        settings?: ProductSetsInput['settings']
        baseText?: string
        reportText?: string
        information?: string
        productName?: string
        mainImage?: string
        images?: string[]
        slots?: unknown[]
        jobId: string
      }
      const slots: GenerationSlotGraph[] = (Array.isArray(p.slots) ? p.slots : []).map((s, index) => {
        const rec = (s ?? {}) as Record<string, unknown>
        return {
          id: String(rec.id ?? `slot-${index}`),
          name: String(rec.name ?? ''),
          type: String(rec.type ?? ''),
          typeKey: String(rec.typeKey ?? ''),
          sequence: Number(rec.sequence ?? index + 1),
          prompt: String(rec.prompt ?? ''),
          status: 'idle' as const,
        }
      })
      const deps = {
        checkpointer: new PrismaCheckpointSaver(),
        planPrompts: async (slotItems: GenerationSlotGraph[]): Promise<Record<string, string>> => {
          const res = await generatePrompts({
            userId: p.userId,
            settings: p.settings,
            baseText: p.baseText,
            reportText: p.reportText,
            information: p.information,
            promptSlots: slotItems.map((s) => ({ id: s.id, name: s.name, type: s.type, sequence: s.sequence })),
          })
          return Object.fromEntries((res.prompts ?? []).map((x) => [x.id ?? '', x.prompt ?? '']))
        },
        generateImage: async ({ slot, jobId }: { slot: GenerationSlotGraph; jobId: string }) => {
          const imgRes = await generateImageCapability(
            {
              userId: p.userId,
              tenantId: p.tenantId ?? 'local',
              prompt: slot.prompt,
              size: '2K',
              ratio: p.settings?.ratio,
              image: p.mainImage || undefined,
              images: p.images ?? [],
              name: slot.name,
              slotType: slot.type,
              productName: p.productName?.trim() || undefined,
              jobId,
            },
            undefined,
            roots.userRoot,
          )
          const img = imgRes.images[0]
          if (!img) throw new Error('当前未接入真实图像服务，未返回可展示图片')
          return {
            url: img.url,
            asset: {
              id: img.id,
              url: img.url,
              originalName: slot.name,
              category: slot.type,
              prompt: slot.prompt,
              ratio: p.settings?.ratio ?? '1:1',
              productName: p.productName?.trim() || undefined,
            },
          }
        },
      }
      return runProductSetGraph(deps, { slots }, { threadId: p.jobId, emit: (event) => ctx?.emit(event) })
    },
    // LangGraph 编排的详情图批量生成：dispatch → Send 扇出逐模块 generateOne（规划阶段仍为页内单次调用 + 人工审改）。
    // 流式经 ctx.emit 转发节点级进度（node:generateImage / done）。
    'productSets.detailGraph.run': async (payload, ctx) => {
      const roots = workerDataRoots()
      const p = payload as {
        userId: string
        tenantId?: string
        settings?: ProductSetsInput['settings']
        images?: string[]
        modules?: unknown[]
        jobId: string
      }
      const modules: DetailModuleGraph[] = (Array.isArray(p.modules) ? p.modules : []).map((m, index) => {
        const rec = (m ?? {}) as Record<string, unknown>
        return {
          instanceId: String(rec.instanceId ?? `module-${index}`),
          title: String(rec.title ?? ''),
          key: String(rec.key ?? ''),
          prompt: String(rec.prompt ?? ''),
          status: 'idle' as const,
          sequence: Number(rec.sequence ?? index + 1),
        }
      })
      const deps = {
        checkpointer: new PrismaCheckpointSaver(),
        generateImage: async ({ module, jobId }: { module: DetailModuleGraph; jobId: string }) => {
          const imgRes = await generateImageCapability(
            {
              userId: p.userId,
              tenantId: p.tenantId ?? 'local',
              prompt: module.prompt,
              size: '2K',
              ratio: p.settings?.ratio,
              image: p.images?.[0],
              images: p.images ?? [],
              name: module.title,
              slotType: module.title,
              jobId,
            },
            undefined,
            roots.userRoot,
          )
          const img = imgRes.images[0]
          if (!img) throw new Error('当前未接入真实图像服务，未返回可展示图片')
          return {
            url: img.url,
            asset: {
              id: img.id,
              url: img.url,
              originalName: module.title,
              category: module.title,
              prompt: module.prompt,
              ratio: p.settings?.ratio ?? '1:1',
            },
          }
        },
      }
      return runDetailGraph(deps, { modules }, { threadId: p.jobId, emit: (event) => ctx?.emit(event) })
    },
    'report.generate': async (payload) => generateReport(payload as GenerateReportInput),
    'report.jobs': async (payload) => listReportJobs(payload as { tenantId: string; status?: string; page?: number; pageSize?: number }),
    'report.list': async (payload) => listReports(payload as { tenantId: string; keyword?: string; status?: string; page?: number; pageSize?: number }),
    'report.latest': async (payload) => latestReport(payload as { tenantId: string; keyword?: string }),
    'report.detail': async (payload) => getReport(payload as { tenantId: string; runId: string }),
    'report.export': async (payload) => exportReport(payload as { userId: string; tenantId: string; runId: string; format: ReportExportFormat }),
    'report.products': async (payload) => reportProducts(payload as { tenantId: string; runId: string; keyword?: string; productId?: string; shopName?: string; skuKeyword?: string; page?: number; pageSize?: number }),
    'report.mainImageAnalysis.run': async (payload) => runMainImageAnalysis(payload as { userId: string; tenantId: string; runId: string; productId?: string; imageUrl?: string }),
    'report.mainImageAnalysis.get': async (payload) => getMainImageAnalysis(payload as { tenantId: string; runId: string; productId: string }),
    'report.priceBandsPreview': async (payload) => priceBandsPreview(payload as { tenantId: string; keyword?: string; runId?: string; costPrice?: number; shippingCost?: number; packagingCost?: number; laborCost?: number; platformFeeRate?: number; adFeeRate?: number; targetMargin?: number }),
    'report.rerunBand': async (payload) => rerunBandAnalysis(payload as { userId: string; tenantId: string; keyword?: string; bandName: string }),
    'dataAgent.datasets': async (payload) => dataAgentDatasets(payload as { tenantId: string; keyword?: string }),
    'dataAgent.chat': async (payload) => dataAgentChat(payload as { userId: string; tenantId: string; question: string; datasetId?: string; jobId?: string; keyword?: string; history?: Array<{ role?: string; content?: string }> }),
    'ai.selfConfig.get': async (payload) => getSelfConfig(String((payload as { userId?: string })?.userId ?? '')),
    'ai.selfConfig.save': async (payload) => saveSelfConfig(String((payload as { userId?: string })?.userId ?? ''), payload as SaveSelfConfigInput),
    'ai.defaultConfig.set': async (payload) => setServerDefault(String((payload as { userId?: string })?.userId ?? ''), payload as Parameters<typeof setServerDefault>[1]),
    'analysis.jobs.create': async (payload) => createAnalysisJob(payload as CreateAnalysisJobInput & { tenantId?: string; userId?: string }),
    'analysis.jobs.get': async (payload) => getAnalysisJob(String((payload as { id?: string })?.id ?? ''), String((payload as { tenantId?: string })?.tenantId ?? 'local')),
    'analysis.jobs.cancel': async (payload) => cancelAnalysisJob(String((payload as { id?: string })?.id ?? ''), String((payload as { tenantId?: string })?.tenantId ?? 'local')),
    'product.list': async (payload) => listProducts(String((payload as { tenantId?: string })?.tenantId ?? 'local'), (payload as { keyword?: string; status?: string })),
    'product.create': async (payload) => createProduct(String((payload as { tenantId?: string })?.tenantId ?? 'local'), payload as SaveProductInput),
    'product.update': async (payload) => updateProduct(String((payload as { tenantId?: string })?.tenantId ?? 'local'), String((payload as { id?: string })?.id ?? ''), payload as SaveProductInput),
    'product.delete': async (payload) => deleteProduct(String((payload as { tenantId?: string })?.tenantId ?? 'local'), String((payload as { id?: string })?.id ?? '')),
  }
}

function electronHost(): WorkerHost | null {
  type Port = { postMessage: (m: unknown) => void; on: (e: string, cb: (e: { data: unknown }) => void) => void }
  let parentPort: Port | undefined
  try {
    // Electron utilityProcess 通信端口存在两种暴露方式：require('electron').parentPort 或全局 process.parentPort。
    // Electron 37 的主要通道是 process.parentPort，先两种都试一遍，避免某版本下取不到 parentPort 导致 worker 静默不 ready。
    parentPort = (require('electron') as { parentPort?: Port }).parentPort
    if (!parentPort) parentPort = (process as { parentPort?: Port }).parentPort
  } catch {
    parentPort = (process as { parentPort?: Port }).parentPort
  }
  if (!parentPort) {
    // 走到这里说明本 worker 不是被 Electron utilityProcess 拉起（例如单测/独立运行），打印到 stderr 便于在应用日志定位。
    console.error('[worker] 未找到 Electron parentPort，能力 worker 未激活')
    return null
  }
  return {
    pid: process.pid,
    postMessage: (message) => parentPort!.postMessage(message),
    onMessage: (handler) => parentPort!.on('message', (event) => handler(event.data)),
  }
}

const host = electronHost()
if (host) startWorkerRuntime(host, createBuiltinHandlers())
