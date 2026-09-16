import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'
import { loadBackendEnv } from '../src/env'

const prisma = new PrismaClient()
loadBackendEnv()

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD || 'change-me'
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'super-admin-change-me'
  const superPermissions = new Set(['system:tenant:manage'])

  const tenant = await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', name: '默认租户' },
  })

  const systemTenant = await prisma.tenant.upsert({
    where: { id: 'system' },
    update: {},
    create: { id: 'system', name: '平台系统' },
  })

  const adminRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'admin' } },
    update: {},
    create: { tenantId: tenant.id, code: 'admin', name: '管理员' },
  })

  const permissionSeeds = [
    { code: 'dashboard:view', name: '查看看板', type: 'menu' },
    { code: 'analysis:view', name: '查看分析', type: 'menu' },
    { code: 'analysis:collect', name: '发起采集', type: 'menu' },
    { code: 'image:generate', name: '图片生成', type: 'menu' },
    { code: 'image:view', name: '查看图片', type: 'menu' },
    { code: 'listing:view', name: '平台发布', type: 'menu' },
    { code: 'asset:view', name: '查看资产', type: 'menu' },
    { code: 'data:download', name: '数据下载', type: 'menu' },
    { code: 'data:agent', name: '数据 Agent', type: 'menu' },
    { code: 'system:manage', name: '系统管理', type: 'menu' },
    { code: 'system:tenant:manage', name: '租户管理', type: 'menu' },
    { code: 'user:manage', name: '用户管理', type: 'menu' },
    { code: 'role:manage', name: '角色管理', type: 'menu' },
    { code: 'store:manage', name: '店铺管理', type: 'menu' },
    { code: 'department:manage', name: '部门管理', type: 'menu' },
    { code: 'market:report:generate', name: '生成报告', type: 'button' },
    { code: 'market:report:view', name: '查看报告', type: 'button' },
    { code: 'image:regenerate', name: '重新生成图片', type: 'button' },
    { code: 'listing:submit', name: '提交发布', type: 'button' },
    { code: 'review:decide', name: '审核决策', type: 'button' },
  ]

  for (const permission of permissionSeeds) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {},
      create: permission,
    })
  }

  const adminUser = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: process.env.ADMIN_USERNAME || 'admin' } },
    update: { passwordHash: hashPassword(adminPassword), displayName: '管理员', isActive: true },
    create: {
      tenantId: tenant.id,
      username: process.env.ADMIN_USERNAME || 'admin',
      passwordHash: hashPassword(adminPassword),
      displayName: '管理员',
      dataScope: 'all',
    },
  })

  const systemAdminRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: systemTenant.id, code: 'system_admin' } },
    update: { name: '超级管理员' },
    create: { tenantId: systemTenant.id, code: 'system_admin', name: '超级管理员' },
  })

  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME?.trim() || 'super_admin'
  if (superAdminUsername !== 'platform_admin') {
    const legacy = await prisma.user.findMany({
      where: { tenantId: systemTenant.id, username: 'platform_admin' },
      select: { id: true },
    })
    if (legacy.length > 0) {
      await prisma.userRole.deleteMany({ where: { userId: { in: legacy.map((row) => row.id) } } })
      await prisma.user.deleteMany({ where: { id: { in: legacy.map((row) => row.id) } } })
    }
  }
  const superAdmin = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: systemTenant.id, username: superAdminUsername } },
    update: { passwordHash: hashPassword(superAdminPassword), displayName: '超级管理员', isActive: true },
    create: {
      tenantId: systemTenant.id,
      username: superAdminUsername,
      passwordHash: hashPassword(superAdminPassword),
      displayName: '超级管理员',
      dataScope: 'all',
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  })

  for (const permission of await prisma.permission.findMany()) {
    if (!superPermissions.has(permission.code)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: permission.id },
      })
    }
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: systemAdminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: systemAdminRole.id, permissionId: permission.id },
    })
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: systemAdminRole.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: systemAdminRole.id },
  })

  const platformSeeds = [
    { code: 'taobao', name: '淘宝' },
    { code: 'jd', name: '京东' },
    { code: 'pdd', name: '拼多多' },
    { code: 'douyin', name: '抖店' },
  ]
  for (const platform of platformSeeds) {
    await prisma.platform.upsert({
      where: { code: platform.code },
      update: {},
      create: platform,
    })
  }

  console.log(`seed 完成：租户 ${tenant.id}/${systemTenant.id}，管理员 ${adminUser.username}，超级管理员 ${superAdmin.username}，权限 ${permissionSeeds.length} 个，平台 ${platformSeeds.length} 个`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
