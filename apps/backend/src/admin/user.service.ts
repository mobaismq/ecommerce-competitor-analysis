import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { hashPassword } from '../auth/password'
import { PrismaService } from '../prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  list(scope: { tenantId: string; userId: string; dataScope?: string; departmentId?: string | null }) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        tenantId: scope.tenantId,
        ...(scope.dataScope === 'self' ? { id: scope.userId } : {}),
        ...(scope.dataScope === 'department' && scope.departmentId ? { departmentId: scope.departmentId } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        phone: true,
        email: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
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
