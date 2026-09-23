import { NotFoundException } from '@nestjs/common'
import { DepartmentService } from './department.service'

function makeService(prisma?: any) {
  return new DepartmentService((prisma ?? {}) as never)
}

describe('DepartmentService（5.12 dept 层级 + 启用状态）', () => {
  it('无父级创建：level=1、enabled 默认 true', async () => {
    const department = { create: jest.fn().mockResolvedValue({ id: 'd1' }) }
    const prisma = { department }
    const service = makeService(prisma)
    await service.create('t1', { name: '研发部' })
    expect(department.create).toHaveBeenCalledWith({ data: expect.objectContaining({ level: 1, enabled: true }) })
  })

  it('带父级创建：level = 父级 level + 1（对照旧版按父级 deptLevel+1）', async () => {
    const department = {
      findFirst: jest.fn().mockResolvedValue({ id: 'parent', level: 2 }),
      create: jest.fn().mockResolvedValue({ id: 'd2' }),
    }
    const service = makeService({ department })
    await service.create('t1', { name: '后端组', parentId: 'parent' })
    expect(department.findFirst).toHaveBeenCalledWith({ where: { id: 'parent', tenantId: 't1', deletedAt: null } })
    expect(department.create).toHaveBeenCalledWith({ data: expect.objectContaining({ level: 3 }) })
  })

  it('update 支持停用 enabled=false', async () => {
    const department = {
      findFirst: jest.fn().mockResolvedValue({ id: 'd1', tenantId: 't1' }),
      update: jest.fn().mockResolvedValue({ id: 'd1', enabled: false }),
    }
    const service = makeService({ department })
    await service.update('t1', 'd1', { enabled: false })
    expect(department.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: expect.objectContaining({ enabled: false }) })
  })

  it('update 变更父级时自动重算 level', async () => {
    const department = {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ id: 'd1', tenantId: 't1' })
        .mockResolvedValueOnce({ id: 'newParent', level: 2 }),
      update: jest.fn().mockResolvedValue({ id: 'd1' }),
    }
    const service = makeService({ department })
    await service.update('t1', 'd1', { parentId: 'newParent' })
    expect(department.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: expect.objectContaining({ level: 3, parentId: 'newParent' }) })
  })

  it('update 部门不存在时抛 NotFoundException', async () => {
    const department = { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() }
    const service = makeService({ department })
    await expect(service.update('t1', 'nope', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException)
  })
})
