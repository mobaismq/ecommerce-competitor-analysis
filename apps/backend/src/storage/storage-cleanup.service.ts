import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { StorageDriverService } from './storage.service'

@Injectable()
export class StorageCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageDriverService: StorageDriverService,
  ) {}

  async cleanupOrphans() {
    const driver = this.storageDriverService.getDriver()
    const objects = await driver.listObjects()
    const [generated, media] = await Promise.all([
      this.prisma.generatedAsset.findMany({ select: { storageKey: true } }),
      this.prisma.mediaAsset.findMany({ select: { storageKey: true } }),
    ])
    const referenced = new Set([...generated, ...media].map((row) => row.storageKey))
    const orphans = objects.filter((key) => !referenced.has(key))
    let deleted = 0
    const errors: string[] = []
    for (const key of orphans) {
      try {
        if (await driver.delete(key)) deleted += 1
      } catch (error) {
        errors.push(`${key}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return { scanned: objects.length, referencedCount: referenced.size, orphanCount: orphans.length, deleted, errors }
  }
}
