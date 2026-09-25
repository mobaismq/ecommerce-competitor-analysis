import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
} from '@langchain/langgraph'
import type { RunnableConfig } from '@langchain/core/runnables'
import { getWorkerPrisma } from './worker-db'

/** getCheckpointId 未从 @langchain/langgraph re-export，直接读 config 里的 checkpoint_id。 */
function checkpointIdOf(config: RunnableConfig): string {
  return String(config.configurable?.checkpoint_id ?? '')
}

/**
 * Prisma/SQLite 后端的 BaseCheckpointSaver，供 LangGraph 图断点续跑。
 *
 * 之所以不直接用 @langchain/langgraph-checkpoint-sqlite：后者依赖原生模块 better-sqlite3，
 * 而本项目当前没有 electron-rebuild/asar 解包的原生模块打包机制，且 worker 已用 Prisma 连本地
 * ~/.ecommerce/desktop.db。这里复用同一棵 Prisma 连接写两张 checkpoint 表，零新增原生依赖，
 * 语义与官方 SqliteSaver 一致。BaseCheckpointSaver 是 LangGraph 统一接口，后续若要换官方
 * SqliteSaver，只需替换本实现，业务代码不动。
 *
 * 存储格式：checkpoint/metadata/value 存 `type:base64`（JsonPlusSerializer.dumpsTyped 返回
 * [type, Uint8Array]，type 通常是 "json"，channel value 可能是 "bytes"），loadsTyped 时按 type 还原。
 */
function enc([type, data]: [string, Uint8Array]): string {
  return `${type}:${Buffer.from(data).toString('base64')}`
}

function dec(s: string): [string, Uint8Array] {
  const idx = s.indexOf(':')
  return [s.slice(0, idx), Buffer.from(s.slice(idx + 1), 'base64')]
}

interface CheckpointRow {
  threadId: string
  checkpointNs: string
  checkpointId: string
  parentCheckpointId: string | null
  checkpoint: string
  metadata: string
}

export class PrismaCheckpointSaver extends BaseCheckpointSaver {
  /** 内存缓存该 thread 下最新的 checkpoint 行，用于 getTuple 无 checkpoint_id 时快速取最新。 */
  private latestCache = new Map<string, CheckpointRow>()

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined
    const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) ?? ''
    if (!threadId) return undefined
    const checkpointId = checkpointIdOf(config)

    const row = checkpointId
      ? await this.findRow(threadId, checkpointNs, checkpointId)
      : await this.latestRow(threadId, checkpointNs)
    if (!row) return undefined

    return this.rowToTuple(row, config, checkpointId)
  }

  async *list(config: RunnableConfig, options?: { limit?: number; before?: RunnableConfig; filter?: Record<string, unknown> }): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined
    const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) ?? ''
    const configCheckpointId = checkpointIdOf(config)
    if (!threadId) return

    const rows = await this.rowsForThread(threadId, checkpointNs)
    let limit = options?.limit
    for (const row of rows) {
      if (configCheckpointId && row.checkpointId !== configCheckpointId) continue
      if (options?.before?.configurable?.checkpoint_id && row.checkpointId >= String(options.before.configurable.checkpoint_id)) continue
      const metadata = await this.serde.loadsTyped(...dec(row.metadata))
      if (options?.filter && !Object.entries(options.filter).every(([key, value]) => (metadata as Record<string, unknown>)[key] === value)) continue
      if (limit !== undefined) {
        if (limit <= 0) return
        limit -= 1
      }
      yield this.rowToTuple(row, config, row.checkpointId)
    }
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string | undefined
    const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) ?? ''
    if (!threadId) throw new Error('put: RunnableConfig 缺少 configurable.thread_id（使用 checkpointer 时必须传 thread_id）')
    const parentCheckpointId = (config.configurable?.checkpoint_id as string | undefined) ?? null

    const [serializedCheckpoint, serializedMetadata] = await Promise.all([
      this.serde.dumpsTyped(checkpoint).then(enc),
      this.serde.dumpsTyped(metadata).then(enc),
    ])

    const db = getWorkerPrisma()
    const upserted = await db.langGraphCheckpoint.upsert({
      where: { threadId_checkpointNs_checkpointId: { threadId, checkpointNs, checkpointId: checkpoint.id } },
      create: { threadId, checkpointNs, checkpointId: checkpoint.id, parentCheckpointId, checkpoint: serializedCheckpoint, metadata: serializedMetadata },
      update: { checkpoint: serializedCheckpoint, metadata: serializedMetadata, parentCheckpointId },
    })
    const row: CheckpointRow = {
      threadId,
      checkpointNs,
      checkpointId: upserted.checkpointId,
      parentCheckpointId: upserted.parentCheckpointId,
      checkpoint: upserted.checkpoint,
      metadata: upserted.metadata,
    }
    this.latestCache.set(threadId, row)
    return {
      configurable: { thread_id: threadId, checkpoint_ns: checkpointNs, checkpoint_id: checkpoint.id },
    }
  }

  async putWrites(config: RunnableConfig, writes: Array<[string, unknown]>, taskId: string): Promise<void> {
    const threadId = config.configurable?.thread_id as string | undefined
    const checkpointNs = (config.configurable?.checkpoint_ns as string | undefined) ?? ''
    const checkpointId = config.configurable?.checkpoint_id as string | undefined
    if (!threadId) throw new Error('putWrites: 缺少 configurable.thread_id')
    if (!checkpointId) throw new Error('putWrites: 缺少 configurable.checkpoint_id')

    const db = getWorkerPrisma()
    await Promise.all(
      writes.map(async ([channel, value], idx) => {
        const [type, data] = await this.serde.dumpsTyped(value)
        const stored = enc([type, data])
        await db.langGraphCheckpointWrite.upsert({
          where: {
            threadId_checkpointNs_checkpointId_taskId_writeIdx: { threadId, checkpointNs, checkpointId, taskId, writeIdx: idx },
          },
          create: { threadId, checkpointNs, checkpointId, taskId, writeIdx: idx, channel, value: stored },
          update: { channel, value: stored },
        })
      }),
    )
  }

  async deleteThread(threadId: string): Promise<void> {
    const db = getWorkerPrisma()
    await db.langGraphCheckpoint.deleteMany({ where: { threadId } })
    await db.langGraphCheckpointWrite.deleteMany({ where: { threadId } })
    this.latestCache.delete(threadId)
  }

  // ── helpers ──
  private async findRow(threadId: string, checkpointNs: string, checkpointId: string): Promise<CheckpointRow | undefined> {
    const db = getWorkerPrisma()
    const row = await db.langGraphCheckpoint.findUnique({
      where: { threadId_checkpointNs_checkpointId: { threadId, checkpointNs, checkpointId } },
    })
    return row ?? undefined
  }

  private async rowsForThread(threadId: string, checkpointNs: string): Promise<CheckpointRow[]> {
    const db = getWorkerPrisma()
    const rows = await db.langGraphCheckpoint.findMany({
      where: { threadId, checkpointNs },
      orderBy: { checkpointId: 'desc' },
    })
    return rows
  }

  private async latestRow(threadId: string, checkpointNs: string): Promise<CheckpointRow | undefined> {
    const cached = this.latestCache.get(threadId)
    if (cached && cached.checkpointNs === checkpointNs) return cached
    const rows = await this.rowsForThread(threadId, checkpointNs)
    const latest = rows[0]
    if (latest) this.latestCache.set(threadId, latest)
    return latest
  }

  private async rowToTuple(row: CheckpointRow, config: RunnableConfig, explicitCheckpointId?: string): Promise<CheckpointTuple> {
    const checkpoint = (await this.serde.loadsTyped(...dec(row.checkpoint))) as Checkpoint
    const metadata = (await this.serde.loadsTyped(...dec(row.metadata))) as CheckpointMetadata

    const db = getWorkerPrisma()
    const writes = await db.langGraphCheckpointWrite.findMany({
      where: { threadId: row.threadId, checkpointNs: row.checkpointNs, checkpointId: row.checkpointId },
    })
    const pendingWrites = await Promise.all(
      writes.map(async (w) => {
        const value = await this.serde.loadsTyped(...dec(w.value))
        return [w.taskId, w.channel, value] as [string, string, unknown]
      }),
    )

    const threadId = row.threadId
    const checkpointNs = row.checkpointNs
    const tupleConfig = explicitCheckpointId
      ? config
      : { configurable: { thread_id: threadId, checkpoint_ns: checkpointNs, checkpoint_id: row.checkpointId } }
    const tuple: CheckpointTuple = {
      config: tupleConfig,
      checkpoint,
      metadata,
      pendingWrites,
    }
    if (row.parentCheckpointId) {
      tuple.parentConfig = {
        configurable: { thread_id: threadId, checkpoint_ns: checkpointNs, checkpoint_id: row.parentCheckpointId },
      }
    }
    return tuple
  }
}
