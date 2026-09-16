import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma.service'
import { CreateProviderProfileDto } from './dto/create-provider-profile.dto'
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto'
import { assertSafeBaseUrl } from './ssrf'

function maskRef(ref: string) {
  return ref.length <= 4 ? '****' : `${ref.slice(0, 3)}***`
}

@Injectable()
export class ProviderProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const rows = await this.prisma.providerProfile.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      orderBy: [{ enabled: 'desc' }, { priority: 'desc' }],
    })
    return rows.map((row) => ({ ...row, apiKeyRef: maskRef(row.apiKeyRef) }))
  }

  async create(tenantId: string, dto: CreateProviderProfileDto) {
    assertSafeBaseUrl(dto.baseUrl)
    const row = await this.prisma.providerProfile.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type,
        baseUrl: dto.baseUrl,
        apiKeyRef: dto.apiKeyRef,
        capabilitiesJson: dto.capabilities ? ({ capabilities: dto.capabilities } as Prisma.InputJsonValue) : undefined,
        modelConfigJson: dto.modelConfig as Prisma.InputJsonValue,
        timeoutMs: dto.timeoutMs,
        retryPolicyJson: dto.retryPolicy as Prisma.InputJsonValue,
        limitsJson: dto.limits as Prisma.InputJsonValue,
        enabled: dto.enabled ?? true,
        priority: dto.priority ?? 0,
      },
    })
    return { ...row, apiKeyRef: maskRef(row.apiKeyRef) }
  }

  async update(tenantId: string, id: string, dto: UpdateProviderProfileDto) {
    assertSafeBaseUrl(dto.baseUrl)
    const existing = await this.prisma.providerProfile.findFirst({ where: { id, OR: [{ tenantId }, { tenantId: null }] } })
    if (!existing) throw new NotFoundException('ProviderProfile 不存在')
    const row = await this.prisma.providerProfile.update({
      where: { id },
      data: {
        name: dto.name,
        baseUrl: dto.baseUrl,
        apiKeyRef: dto.apiKeyRef,
        capabilitiesJson: dto.capabilities ? ({ capabilities: dto.capabilities } as Prisma.InputJsonValue) : undefined,
        modelConfigJson: dto.modelConfig as Prisma.InputJsonValue,
        timeoutMs: dto.timeoutMs,
        retryPolicyJson: dto.retryPolicy as Prisma.InputJsonValue,
        limitsJson: dto.limits as Prisma.InputJsonValue,
        enabled: dto.enabled,
        priority: dto.priority,
      },
    })
    return { ...row, apiKeyRef: maskRef(row.apiKeyRef) }
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.providerProfile.findFirst({ where: { id, OR: [{ tenantId }, { tenantId: null }] } })
    if (!existing) throw new NotFoundException('ProviderProfile 不存在')
    await this.prisma.providerProfile.delete({ where: { id } })
    return { ok: true }
  }

  async activate(tenantId: string, id: string) {
    const target = await this.prisma.providerProfile.findFirst({ where: { id, OR: [{ tenantId }, { tenantId: null }] } })
    if (!target) throw new NotFoundException('ProviderProfile 不存在')
    const capabilities = (target.capabilitiesJson as { capabilities?: string[] } | null)?.capabilities ?? []
    if (capabilities.length === 0) {
      throw new BadRequestException('Profile 未声明能力，无法激活')
    }
    const candidates = await this.prisma.providerProfile.findMany({
      where: { enabled: true, tenantId, id: { not: id } },
      select: { id: true, capabilitiesJson: true },
    })
    const targetSet = new Set(capabilities)
    const toDisable = candidates
      .filter((row) => {
        const rowCapabilities = (row.capabilitiesJson as { capabilities?: string[] } | null)?.capabilities ?? []
        return rowCapabilities.some((capability) => targetSet.has(capability))
      })
      .map((row) => row.id)
    if (toDisable.length > 0) {
      await this.prisma.providerProfile.updateMany({
        where: { id: { in: toDisable } },
        data: { enabled: false },
      })
    }
    await this.prisma.providerProfile.update({ where: { id }, data: { enabled: true, priority: 1 } })
    return { ok: true, id: target.id, type: target.type, capabilities }
  }

  test(dto: { baseUrl?: string }) {
    assertSafeBaseUrl(dto.baseUrl)
    return { ok: true, message: 'connection mock ok' }
  }
}
