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
import { getSelfConfig, saveSelfConfig, type SaveSelfConfigInput } from './ai-config'
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
    'dataAgent.chat': async (payload) => dataAgentChat(payload as { userId: string; tenantId: string; question: string; datasetId?: string; jobId?: string }),
    'ai.selfConfig.get': async (payload) => getSelfConfig(String((payload as { userId?: string })?.userId ?? '')),
    'ai.selfConfig.save': async (payload) => saveSelfConfig(String((payload as { userId?: string })?.userId ?? ''), payload as SaveSelfConfigInput),
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
  try {
    // 仅在 Electron utilityProcess 内存在 parentPort
    const { parentPort } = require('electron') as { parentPort?: { postMessage: (m: unknown) => void; on: (e: string, cb: (e: { data: unknown }) => void) => void } }
    if (!parentPort) return null
    return {
      pid: process.pid,
      postMessage: (message) => parentPort!.postMessage(message),
      onMessage: (handler) => parentPort!.on('message', (event) => handler(event.data)),
    }
  } catch {
    return null
  }
}

const host = electronHost()
if (host) startWorkerRuntime(host, createBuiltinHandlers())
