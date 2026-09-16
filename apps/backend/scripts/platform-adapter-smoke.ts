import { loadBackendEnv } from '../src/env'
import { PlatformRegistry } from '../src/platform/platform-registry'
import { PlatformAdapterService } from '../src/platform/platform.service'
import { PrismaService } from '../src/prisma.service'

async function main() {
  loadBackendEnv()
  process.env.PLATFORM_MOCK = 'true'
  const prisma = new PrismaService()
  const registry = new PlatformRegistry()
  const service = new PlatformAdapterService(prisma, registry)

  const taobao = registry.create('taobao')
  const mock = registry.create('mock')
  const taobaoCategories = await taobao.fetchCategories('0')
  const taobaoShops = await taobao.fetchShops()
  const mockCategories = await mock.fetchCategories('0')

  const platforms = await service.listPlatforms()
  const serviceCategories = await service.getCategories('taobao', '0')
  const serviceShops = await service.getShops('taobao')

  let unknownRejected = false
  try {
    registry.create('not-a-platform')
  } catch {
    unknownRejected = true
  }

  const output = {
    adapterCodes: registry.listCodes(),
    taobao: {
      configStatus: (taobao as { configStatus?: () => unknown }).configStatus?.() ?? null,
      categoryCount: taobaoCategories.length,
      categoryRawKept: taobaoCategories.every((item) => item.rawPayload != null),
      shopCount: taobaoShops.length,
      shopRawKept: taobaoShops.every((item) => item.rawPayload != null),
      childFiltered: (await taobao.fetchCategories('50008163')).map((item) => item.externalId),
    },
    mock: { categoryCount: mockCategories.length },
    dictionary: platforms.map((item) => item.code),
    service: {
      categories: serviceCategories.map((item) => ({ externalId: item.externalId, name: item.name })),
      shops: serviceShops.map((item) => item.externalId),
    },
    unknownRejected,
  }
  console.log(JSON.stringify(output))
  await prisma.$disconnect()

  const ok =
    output.adapterCodes.includes('taobao') &&
    output.adapterCodes.includes('mock') &&
    output.taobao.categoryCount === 3 &&
    output.taobao.categoryRawKept &&
    output.taobao.shopCount === 1 &&
    output.taobao.shopRawKept &&
    output.taobao.childFiltered.length === 1 &&
    output.mock.categoryCount === 2 &&
    output.dictionary.includes('taobao') &&
    output.service.categories.length === 3 &&
    output.service.shops.length === 1 &&
    output.unknownRejected
  process.exit(ok ? 0 : 1)
}

void main()
