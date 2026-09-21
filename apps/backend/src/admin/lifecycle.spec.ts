import { BadRequestException, NotFoundException } from '@nestjs/common'
import type { PrismaService } from '../prisma.service'
import { RoleService } from './role.service'
import { UserService } from './user.service'
import { StoreService } from './store.service'
import { DepartmentService } from './department.service'

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
      },
      rolePermission: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
      roleStore: { findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
      store: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      platform: { findUnique: jest.fn() },
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
})
