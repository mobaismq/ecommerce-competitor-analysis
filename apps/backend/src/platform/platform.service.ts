import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { PlatformRegistry } from './platform-registry'

@Injectable()
export class PlatformAdapterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PlatformRegistry,
  ) {}

  listPlatforms() {
    return this.prisma.platform.findMany({ orderBy: { code: 'asc' } })
  }

  listAdapterCodes() {
    return this.registry.listCodes()
  }

  getAdapter(code: string) {
    return this.registry.create(code)
  }

  async getCategories(code: string, parentExternalId?: string) {
    const adapter = this.getAdapter(code)
    if (!adapter.supports('categories')) throw new BadRequestException(`平台 ${code} 不支持类目查询`)
    return adapter.fetchCategories(parentExternalId ?? '0')
  }

  async getShops(code: string) {
    const adapter = this.getAdapter(code)
    if (!adapter.supports('shops')) throw new BadRequestException(`平台 ${code} 不支持店铺查询`)
    return adapter.fetchShops()
  }
}
