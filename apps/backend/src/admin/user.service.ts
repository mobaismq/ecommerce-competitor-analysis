import { Injectable, NotFoundException } from '@nestjs/common'
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
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          username: dto.username,
          passwordHash: hashPassword(dto.password),
          displayName: dto.displayName,
          dataScope: 'all',
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

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException('用户不存在')
      const data: Record<string, unknown> = {}
      if (dto.displayName !== undefined) data.displayName = dto.displayName
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

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } })
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
}
