import { DataAgentService } from './data-agent.service'

describe('DataAgentService.listDatasets', () => {
  it('补齐旧版价格带与采集时间契约', async () => {
    const createdAt = new Date('2026-09-21T08:00:00Z')
    const prisma = {
      analysisRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'run-1',
            jobId: 'job-1',
            keyword: '蓝牙耳机',
            reportNo: 'R1',
            status: 'success',
            competitorCount: 3,
            createdAt,
            updatedAt: createdAt,
          },
        ]),
      },
      collectionJob: {
        findMany: jest.fn().mockResolvedValue([{ jobId: 'job-1', createdAt, updatedAt: createdAt }]),
      },
      productSnapshot: {
        groupBy: jest.fn().mockResolvedValue([
          { collectionJobId: 'job-1', _min: { price: 19.9 }, _max: { price: 89.5 } },
        ]),
      },
    }
    const service = new DataAgentService(prisma as any, {} as any)

    const result = await service.listDatasets('tenant-1')

    expect(result.datasets[0]).toMatchObject({
      priceRange: '¥19.9-89.5',
      collectTime: createdAt,
    })
  })
})
