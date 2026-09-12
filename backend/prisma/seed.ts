import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-me'

  const tenant = await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', name: '默认租户' },
  })

  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: { code: 'admin', name: '管理员' },
  })

  const permissions = ['system:manage', 'market:report:generate', 'market:report:view', 'asset:view']
  for (const code of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: code },
    })
  }

  const adminUser = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: process.env.ADMIN_USERNAME || 'admin' } },
    update: {},
    create: {
      tenantId: tenant.id,
      username: process.env.ADMIN_USERNAME || 'admin',
      passwordHash: hashPassword(adminPassword),
      displayName: '管理员',
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  })

  for (const permission of await prisma.permission.findMany()) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    })
  }

  const platformCodes = [
    { code: 'taobao', name: '淘宝' },
    { code: 'jd', name: '京东' },
    { code: 'pdd', name: '拼多多' },
    { code: 'douyin', name: '抖店' },
  ]
  for (const platform of platformCodes) {
    await prisma.platform.upsert({
      where: { code: platform.code },
      update: {},
      create: platform,
    })
  }

  console.log(`seed 完成：租户 ${tenant.id}，管理员 ${adminUser.username}，平台 ${platformCodes.length} 个`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
