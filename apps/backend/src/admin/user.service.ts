import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { hashPassword } from '../auth/password'
import { PrismaService } from '../prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    scope: { tenantId: string; userId: string; dataScope?: string; departmentId?: string | null },
    options: { keyword?: string; isActive?: boolean; page?: number; pageSize?: number } = {},
  ) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      tenantId: scope.tenantId,
      ...(scope.dataScope === 'self' ? { id: scope.userId } : {}),
      ...(scope.dataScope === 'department' && scope.departmentId ? { departmentId: scope.departmentId } : {}),
      ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
    }
    if (options.keyword) {
      where.OR = [
        { username: { contains: options.keyword } },
        { displayName: { contains: options.keyword } },
        { phone: { contains: options.keyword } },
        { email: { contains: options.keyword } },
      ]
    }
    const base: Prisma.UserFindManyArgs = {
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        phone: true,
        email: true,
        avatarUrl: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }
    // 提供分页参数时返回 {rows,total} 信封；否则返回裸数组（向后兼容）
    if (options.page !== undefined && options.pageSize !== undefined) {
      const page = Math.max(1, options.page)
      const pageSize = Math.max(1, options.pageSize)
      const [rows, total] = await Promise.all([
        this.prisma.user.findMany({ ...base, skip: (page - 1) * pageSize, take: pageSize }),
        this.prisma.user.count({ where }),
      ])
      return { rows: await this.enrichRoles(rows), total, page, pageSize }
    }
    return this.enrichRoles(await this.prisma.user.findMany(base))
  }

  /** 为列表行补充 roleIds（对照旧版 mapAccountRow 返回 roleIds 数组）+ isDeleted。 */
  private async enrichRoles(rows: Array<{ id: string }>) {
    if (!rows.length) return rows.map((row) => ({ ...row, roleIds: [] as string[], isDeleted: false }))
    const links = await this.prisma.userRole.findMany({ where: { userId: { in: rows.map((row) => row.id) } } })
    const roleIdsByUser = new Map<string, string[]>()
    for (const link of links) {
      const list = roleIdsByUser.get(link.userId) ?? []
      list.push(link.roleId)
      roleIdsByUser.set(link.userId, list)
    }
    return rows.map((row) => ({ ...row, roleIds: roleIdsByUser.get(row.id) ?? [], isDeleted: false }))
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const duplicate = await this.findDuplicate(tenantId, { username: dto.username, phone: dto.phone })
    if (duplicate) throw new BadRequestException(`用户${duplicate}已存在`)
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          username: dto.username,
          passwordHash: hashPassword(dto.password),
          displayName: dto.displayName,
          phone: dto.phone,
          email: dto.email,
          departmentId: dto.departmentId,
          dataScope: dto.dataScope ?? 'all',
        },
      })
      if (dto.roleIds?.length) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: user.id, roleId })),
          skipDuplicates: true,
        })
      }
      return user
    })
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { id, tenantId, deletedAt: null } })
      if (!existing) throw new NotFoundException('用户不存在')
      const duplicate = await this.findDuplicate(tenantId, { username: existing.username, phone: dto.phone }, id)
      if (duplicate) throw new BadRequestException(`用户${duplicate}已存在`)
      const data: Record<string, unknown> = {}
      if (dto.displayName !== undefined) data.displayName = dto.displayName
      if (dto.phone !== undefined) data.phone = dto.phone
      if (dto.email !== undefined) data.email = dto.email
      if (dto.departmentId !== undefined) data.departmentId = dto.departmentId
      if (dto.dataScope !== undefined) data.dataScope = dto.dataScope
      if (dto.isActive !== undefined) data.isActive = dto.isActive
      if (dto.password) data.passwordHash = hashPassword(dto.password)
      if (Object.keys(data).length) await tx.user.update({ where: { id }, data })
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } })
        if (dto.roleIds.length) {
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
            skipDuplicates: true,
          })
        }
      }
      return tx.user.findUnique({ where: { id } })
    })
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new NotFoundException('用户不存在')
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      }),
    ])
    return { ok: true, id }
  }

  /** 5.7 管理员重置他人密码：无需旧密码，限本租户未删除用户（对照旧版 account/change-password 传 accountId）。 */
  async resetPassword(tenantId: string, id: string, password: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, tenantId, deletedAt: null } })
    if (!existing) throw new NotFoundException('用户不存在')
    await this.prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } })
    return { ok: true, id }
  }

  async findDuplicate(tenantId: string, values: { username?: string; phone?: string }, excludeId?: string) {
    const username = values.username?.trim()
    const phone = values.phone?.trim()
    const user = username
      ? await this.prisma.user.findFirst({ where: { tenantId, username, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })
      : phone
        ? await this.prisma.user.findFirst({ where: { tenantId, phone, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } })
        : null
    return user ? (username ? '账号名' : '手机号') : null
  }
}
