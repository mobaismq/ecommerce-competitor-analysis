import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateImageCapability } from './image-capability'

const db = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  removeBytes: vi.fn(),
}))

vi.mock('./worker-db', () => ({
  getWorkerPrisma: () => ({ generatedAsset: db }),
  putBytes: vi.fn(),
  removeBytes: db.removeBytes,
  storageKeyToLocalPath: (key: string, roots: { userRoot: string }) => `${roots.userRoot}/${key}`,
  workerDataRoots: () => ({ internalRoot: '/data/internal', userRoot: '/data/user' }),
}))

beforeEach(() => vi.clearAllMocks())

describe('image.generate in-place replacement', () => {
  it('keeps the slot asset and removes older copies after resize', async () => {
    const current = { id: 'current', storageKey: 'current.png' }
    const duplicate = { id: 'duplicate', storageKey: 'duplicate.png' }
    db.findMany.mockResolvedValue([current, duplicate])
    db.update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }))
    db.deleteMany.mockResolvedValue({ count: 1 })

    const result = await generateImageCapability({
      userId: 'user-1',
      tenantId: 'local',
      jobId: 'job-1',
      name: '01 白底图',
      slotType: '白底图',
      prompt: '调整尺寸',
      ratio: '3:4',
      replaceExisting: true,
    }, { generate: async () => ['data:image/png;base64,AA=='] }, '/data/user')

    expect(result.assetIds).toEqual(['current'])
    expect(db.findMany).toHaveBeenCalledWith({
      where: { jobId: 'job-1', originalName: '01 白底图', category: '白底图' },
      orderBy: [{ createdAt: 'desc' }, { storageKey: 'asc' }],
    })
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'current' } }))
    expect(db.create).not.toHaveBeenCalled()
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['duplicate'] } } })
    expect(db.removeBytes).toHaveBeenCalledTimes(2)
  })
})
