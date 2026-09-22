import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { PrismaService } from '../prisma.service'
import { RoleService } from './role.service'
import { UserService } from './user.service'
import { StoreService } from './store.service'
import { DepartmentService } from './department.service'
import { PlatformService } from './platform.service'

describe('admin lifecycle (离线 mock, 不触真实服务)', () => {
  let prisma: any

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
      role: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      rolePermission: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
      roleStore: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
      store: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      platform: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      department: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    }
  })

  describe('UserService', () => {
    it('创建用户时手机号与旧版账号冲突 → 抛出 BadRequestException', async () => {
      const service = new UserService(prisma as unknown as PrismaService)
      prisma.user.findFirst.mockResolvedValue({ id: 'existing' })
      await expect(
        service.create('tenant-1', { username: 'bob', password: 'x', phone: '13800000000' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('更新用户带 tenantId 校验，跨租户 id 抛 NotFound', async () => {
      const service = new UserService(prisma as unknown as PrismaService)
      prisma.user.findFirst.mockResolvedValue(null)
      await expect(service.update('tenant-a', 'id-of-tenant-b', { displayName: 'x' })).rejects.toThrow(NotFoundException)
    })

    it('删除用户为软删除并停用', async () => {
      const service = new UserService(prisma as unknown as PrismaService)
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' })
      // user.remove 使用 $transaction([...]) 数组形式，直接返回数组结果
      prisma.$transaction.mockImplementation(async (arg: unknown) => (Array.isArray(arg) ? arg : arg))
      prisma.userRole.deleteMany.mockResolvedValue(undefined)
      prisma.user.update.mockResolvedValue({ id: 'u1' })
      await expect(service.remove('tenant-1', 'u1')).resolves.toEqual({ ok: true, id: 'u1' })
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
      )
    })

    it('list 不传分页返回裸数组（向后兼容）', async () => {
      const service = new UserService(prisma as unknown as PrismaService)
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }])
      const rows = await service.list({ tenantId: 'tenant-1', userId: 'u1' })
      expect(Array.isArray(rows)).toBe(true)
      expect(prisma.user.count).not.toHaveBeenCalled()
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
        deletedAt: null,
        tenantId: 'tenant-1',
      })
    })

    it('list 传分页返回 {rows,total,page,pageSize} 信封并按 keyword 过滤', async () => {
      const service = new UserService(prisma as unknown as PrismaService)
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }])
      prisma.user.count.mockResolvedValue(42)
      const res = await service.list({ tenantId: 'tenant-1', userId: 'u1' }, { keyword: 'bob', page: 2, pageSize: 10 })
      expect(res).toMatchObject({ rows: [{ id: 'u1' }], total: 42, page: 2, pageSize: 10 })
      const call = prisma.user.findMany.mock.calls[0][0]
      expect(call.skip).toBe(10)
      expect(call.take).toBe(10)
      expect(call.where.OR).toContainEqual({ username: { contains: 'bob' } })
      expect(prisma.user.count).toHaveBeenCalled()
    })
  })

  describe('RoleService', () => {
    it('创建角色时编码查重', async () => {
      const service = new RoleService(prisma as unknown as PrismaService)
      prisma.role.findFirst.mockResolvedValue({ id: 'r1' })
      await expect(service.create('tenant-1', { code: 'operator', name: '运营' })).rejects.toThrow(BadRequestException)
    })

    it('更新角色带 tenantId，且 storeIds 事务性替换', async () => {
      const service = new RoleService(prisma as unknown as PrismaService)
      prisma.role.findFirst.mockResolvedValue({ id: 'r1', tenantId: 'tenant-1', deletedAt: null })
      prisma.role.update.mockResolvedValue({ id: 'r1' })
      prisma.rolePermission.deleteMany.mockResolvedValue(undefined)
      prisma.roleStore.deleteMany.mockResolvedValue(undefined)
      prisma.roleStore.createMany.mockResolvedValue(undefined)
      prisma.role.findFirst.mockResolvedValueOnce({ id: 'r1', tenantId: 'tenant-1' })
      await service.update('tenant-1', 'r1', { storeIds: ['s1'] })
      expect(prisma.roleStore.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'r1' } })
      expect(prisma.roleStore.createMany).toHaveBeenCalledWith({ data: [{ roleId: 'r1', storeId: 's1' }], skipDuplicates: true })
    })

    it('删除角色软删除并置 disabled', async () => {
      const service = new RoleService(prisma as unknown as PrismaService)
      prisma.role.findFirst.mockResolvedValue({ id: 'r1', deletedAt: null })
      prisma.role.update.mockResolvedValue({ id: 'r1' })
      await expect(service.remove('tenant-1', 'r1')).resolves.toEqual({ ok: true, id: 'r1' })
      expect(prisma.role.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), status: 'disabled' }) }),
      )
    })
  })

  describe('StoreService', () => {
    it('同一平台店铺 ID 查重', async () => {
      const service = new StoreService(prisma as unknown as PrismaService)
      prisma.platform.findUnique.mockResolvedValue({ id: 'p1' })
      prisma.store.findFirst.mockResolvedValue({ id: 's1' })
      await expect(service.create('tenant-1', { platformId: 'p1', name: 'x', externalId: 'tb-1' })).rejects.toThrow(BadRequestException)
    })

    it('删除店铺为软删除', async () => {
      const service = new StoreService(prisma as unknown as PrismaService)
      prisma.store.findFirst.mockResolvedValue({ id: 's1', deletedAt: null })
      prisma.store.update.mockResolvedValue({ id: 's1' })
      await expect(service.remove('tenant-1', 's1')).resolves.toEqual({ ok: true, id: 's1' })
      expect(prisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      )
    })

    it('list 派生授权状态（有效/已过期/未设置）', async () => {
      const service = new StoreService(prisma as unknown as PrismaService)
      prisma.store.findMany.mockResolvedValue([
        { id: 's1', authExpiresAt: new Date(Date.now() + 100000), deletedAt: null },
        { id: 's2', authExpiresAt: new Date(Date.now() - 100000), deletedAt: null },
        { id: 's3', authExpiresAt: null, deletedAt: null },
      ])
      const rows = await service.list('tenant-1')
      const list = Array.isArray(rows) ? rows : rows.rows
      const statuses = new Map(list.map((r) => [r.id, r.authStatus]))
      expect(statuses.get('s1')).toBe('valid')
      expect(statuses.get('s2')).toBe('expired')
      expect(statuses.get('s3')).toBe('none')
    })
  })

  describe('DepartmentService', () => {
    it('存在子部门时禁止删除', async () => {
      const service = new DepartmentService(prisma as unknown as PrismaService)
      prisma.department.findFirst.mockResolvedValue({ id: 'd1', deletedAt: null })
      prisma.department.count.mockResolvedValue(2)
      await expect(service.remove('tenant-1', 'd1')).rejects.toThrow(NotFoundException)
    })

    it('无子部门时软删除部门', async () => {
      const service = new DepartmentService(prisma as unknown as PrismaService)
      prisma.department.findFirst.mockResolvedValue({ id: 'd1', deletedAt: null })
      prisma.department.count.mockResolvedValue(0)
      prisma.department.update.mockResolvedValue({ id: 'd1' })
      await expect(service.remove('tenant-1', 'd1')).resolves.toEqual({ ok: true, id: 'd1' })
      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      )
    })
  })

  describe('PlatformService', () => {
    it('删除平台软删除并停用（对照旧版 platform delete）', async () => {
      const service = new PlatformService(prisma as unknown as PrismaService)
      prisma.platform.findFirst.mockResolvedValue({ id: 'pl1', deletedAt: null })
      prisma.platform.update.mockResolvedValue({ id: 'pl1' })
      await expect(service.remove('pl1')).resolves.toEqual({ ok: true, id: 'pl1' })
      expect(prisma.platform.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), enabled: false }) }),
      )
    })

    it('删除不存在的平台抛 NotFound', async () => {
      const service = new PlatformService(prisma as unknown as PrismaService)
      prisma.platform.findFirst.mockResolvedValue(null)
      await expect(service.remove('none')).rejects.toThrow(NotFoundException)
    })

    it('list 只返回未删除平台', async () => {
      const service = new PlatformService(prisma as unknown as PrismaService)
      prisma.platform.findMany.mockResolvedValue([{ id: 'pl1' }])
      await service.list()
      expect(prisma.platform.findMany).toHaveBeenCalledWith({ where: { deletedAt: null }, orderBy: { code: 'asc' } })
    })

    it('list 传分页返回 {rows,total} 信封并携带 keyword 过滤', async () => {
      const service = new PlatformService(prisma as unknown as PrismaService)
      prisma.platform.findMany.mockResolvedValue([{ id: 'pl1' }])
      prisma.platform.count.mockResolvedValue(1)
      const res = await service.list({ keyword: 'taobao', page: 1, pageSize: 20 })
      expect(res).toMatchObject({ rows: [{ id: 'pl1' }], total: 1, page: 1, pageSize: 20 })
      expect(prisma.platform.count).toHaveBeenCalled()
    })
  })
})
