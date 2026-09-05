import crypto from 'crypto'
import mysql from 'mysql2/promise'

// 业务校验错误统一用 400，便于前端直接展示提示语
export class ApiError extends Error {
  constructor(message, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'sys',
    charset: 'utf8mb4',
    decimalNumbers: true,
    dateStrings: true,
  }
}

async function withConnection(fn) {
  const connection = await mysql.createConnection(mysqlConfig())
  try {
    return await fn(connection)
  } finally {
    await connection.end()
  }
}

const ROLE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sys_role (
    role_id VARCHAR(18) NOT NULL COMMENT '角色ID（18位字母+数字，自动生成）',
    role_name VARCHAR(50) NOT NULL COMMENT '角色名称',
    role_description VARCHAR(200) NULL COMMENT '角色描述',
    role_status TINYINT NOT NULL DEFAULT 1 COMMENT '角色状态：1启用 0停用',
    menu_permission_ids VARCHAR(1000) NULL COMMENT '菜单权限ID（数字，逗号分隔）',
    button_permission_ids VARCHAR(1000) NULL COMMENT '按钮权限ID（数字，逗号分隔）',
    store_permission_ids VARCHAR(1000) NULL COMMENT '店铺权限ID（店铺store_id，逗号分隔）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    created_by VARCHAR(64) NOT NULL COMMENT '创建人',
    updated_by VARCHAR(64) NULL COMMENT '更新人',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '删除状态：0未删除 1已删除',
    PRIMARY KEY (role_id),
    KEY idx_sys_role_name (role_name),
    KEY idx_sys_role_status (role_status),
    KEY idx_sys_role_deleted (is_deleted),
    KEY idx_sys_role_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表'`,
]

async function ensureRoleSchema(connection) {
  for (const statement of ROLE_SCHEMA_STATEMENTS) {
    await connection.query(statement)
  }
  await migrateRoleStatus(connection)
  await migratePermissionFields(connection)
}

// 历史数据迁移：把 role_status 从文字('启用'/'停用')转换为数字(1/0)，并调整列类型
async function migrateRoleStatus(connection) {
  const [columns] = await connection.query(
    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_role' AND COLUMN_NAME = 'role_status'",
  )
  const dataType = columns[0]?.DATA_TYPE
  if (!dataType || /int/i.test(dataType)) return // 已是数字类型，无需迁移
  await connection.query("UPDATE sys_role SET role_status = '0' WHERE role_status IN ('停用','0','disabled','inactive')")
  await connection.query("UPDATE sys_role SET role_status = '1' WHERE role_status NOT IN ('0','1')")
  await connection.query("ALTER TABLE sys_role MODIFY COLUMN role_status TINYINT NOT NULL DEFAULT 1 COMMENT '角色状态：1启用 0停用'")
}

// 历史数据迁移：把 *_permissions_json 列改名为 *_permission_ids 并转为逗号分隔字符串
async function migratePermissionFields(connection) {
  const [oldColumns] = await connection.query("SHOW COLUMNS FROM sys_role LIKE 'menu_permissions_json'")
  if (oldColumns.length === 0) return // 旧列已不存在，无需迁移

  const [rows] = await connection.query('SELECT role_id, menu_permissions_json, button_permissions_json, store_permissions_json FROM sys_role')
  await connection.query("ALTER TABLE sys_role CHANGE COLUMN menu_permissions_json menu_permission_ids VARCHAR(1000) NULL COMMENT '菜单权限ID（数字，逗号分隔）'")
  await connection.query("ALTER TABLE sys_role CHANGE COLUMN button_permissions_json button_permission_ids VARCHAR(1000) NULL COMMENT '按钮权限ID（数字，逗号分隔）'")
  await connection.query("ALTER TABLE sys_role CHANGE COLUMN store_permissions_json store_permission_ids VARCHAR(1000) NULL COMMENT '店铺权限ID（店铺store_id，逗号分隔）'")
  for (const row of rows) {
    await connection.query('UPDATE sys_role SET menu_permission_ids = ?, button_permission_ids = ?, store_permission_ids = ? WHERE role_id = ?', [
      jsonArrayToCsv(row.menu_permissions_json),
      jsonArrayToCsv(row.button_permissions_json),
      jsonArrayToCsv(row.store_permissions_json),
      row.role_id,
    ])
  }
}

// JSON 数组字符串 → 逗号分隔字符串（旧数据迁移用）
function jsonArrayToCsv(value) {
  if (value == null || value === '') return null
  try {
    const arr = JSON.parse(value)
    if (!Array.isArray(arr)) return String(value)
    return arr.map((item) => String(item ?? '')).filter((item) => item !== '').join(',')
  } catch {
    return String(value)
  }
}

// ── 工具函数 ──

const ROLE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// 生成 18 位字母+数字 的角色ID
function generateRoleId() {
  let id = ''
  for (let i = 0; i < 18; i += 1) {
    id += ROLE_ID_ALPHABET[crypto.randomInt(ROLE_ID_ALPHABET.length)]
  }
  return id
}

async function generateUniqueRoleId(connection) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roleId = generateRoleId()
    const [rows] = await connection.query('SELECT 1 AS hit FROM sys_role WHERE role_id = ? LIMIT 1', [roleId])
    if (rows.length === 0) return roleId
  }
  throw new ApiError('角色ID生成失败，请重试', 500)
}

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

// 角色名称：非空 + 最多50字符
function normalizeRoleName(value) {
  const text = value == null ? '' : String(value)
  const trimmed = text.trim()
  if (!trimmed) throw new ApiError('角色名称不可为空')
  if (trimmed.length > 50) throw new ApiError('角色名称最多50个字符')
  return trimmed
}

// 角色描述：最多200字符，允许为空
function normalizeRoleDescription(value) {
  if (value == null) return ''
  const text = String(value).trim()
  if (text.length > 200) throw new ApiError('角色描述最多200个字符')
  return text
}

// 角色状态：1启用 0停用，默认启用(1)
function normalizeRoleStatus(value) {
  if (value == null || String(value).trim() === '') return 1
  const text = String(value).trim()
  if (text === '1' || text === '启用' || text === 'enabled' || text === 'active') return 1
  if (text === '0' || text === '停用' || text === 'disabled' || text === 'inactive') return 0
  throw new ApiError('角色状态仅支持1（启用）或0（停用）')
}

function normalizeRequiredText(value, label) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError(`${label}不可为空`)
  return text
}

// 权限ID：数字ID，逗号分隔存储（如 "1,2,3"）；兼容数组/JSON数组字符串输入
function normalizePermissionIds(value) {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter((item) => item !== '').join(',')
  }
  const text = String(value).trim()
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? normalizePermissionIds(parsed) : text
    } catch {
      return text
    }
  }
  return text
}

// 逗号分隔的权限ID字符串 → 数字ID数组（非数字项丢弃）
function parsePermissionIds(value) {
  if (value == null || value === '') return []
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .map((item) => Number(item))
    .filter((n) => Number.isFinite(n))
}

// 逗号分隔的店铺权限ID字符串 → 字符串ID数组（店铺ID为10位字母+数字）
function parseCsvIds(value) {
  if (value == null || value === '') return []
  return String(value).split(',').map((item) => item.trim()).filter((item) => item !== '')
}

// 全选标记：权限字段存 '*' 表示「全部（含未来新增）」
const ALL_MARKER = '*'

function toAllFlag(value) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

// 全选时存 '*'，否则存具体ID列表
function normalizePermissionValue(ids, allFlag) {
  if (toAllFlag(allFlag)) return ALL_MARKER
  return normalizePermissionIds(ids)
}

// 解析菜单/按钮权限：全选返回 { all: true, ids: [] }，否则返回数字ID数组
function parsePermissionIdsWithAll(value) {
  if (value == null || value === '') return { all: false, ids: [] }
  const parts = String(value).split(',').map((item) => item.trim()).filter((item) => item !== '')
  if (parts.includes(ALL_MARKER)) return { all: true, ids: [] }
  return { all: false, ids: parts.map((item) => Number(item)).filter((n) => Number.isFinite(n)) }
}

// 解析店铺权限：全选返回 { all: true, ids: [] }，否则返回字符串ID数组
function parseCsvIdsWithAll(value) {
  if (value == null || value === '') return { all: false, ids: [] }
  const parts = String(value).split(',').map((item) => item.trim()).filter((item) => item !== '')
  if (parts.includes(ALL_MARKER)) return { all: true, ids: [] }
  return { all: false, ids: parts }
}

function normalizeDeletedFlag(value) {
  if (value == null || value === '') return 0
  if (value === 1 || value === '1' || value === true || value === 'true') return 1
  if (value === 0 || value === '0' || value === false || value === 'false') return 0
  throw new ApiError('删除状态仅支持0或1')
}

function mapRoleRow(row) {
  if (!row) return null
  const menuPerm = parsePermissionIdsWithAll(row.menu_permission_ids)
  const buttonPerm = parsePermissionIdsWithAll(row.button_permission_ids)
  const storePerm = parseCsvIdsWithAll(row.store_permission_ids)
  return {
    roleId: String(row.role_id || ''),
    roleName: String(row.role_name || ''),
    roleDescription: row.role_description == null ? '' : String(row.role_description),
    roleStatus: row.role_status == null ? 1 : Number(row.role_status),
    menuPermissionIds: menuPerm.ids,
    buttonPermissionIds: buttonPerm.ids,
    storePermissionIds: storePerm.ids,
    menuPermissionAll: menuPerm.all,
    buttonPermissionAll: buttonPerm.all,
    storePermissionAll: storePerm.all,
    createdAt: row.created_at == null ? '' : String(row.created_at),
    updatedAt: row.updated_at == null ? '' : String(row.updated_at),
    createdBy: row.created_by == null ? '' : String(row.created_by),
    updatedBy: row.updated_by == null ? '' : String(row.updated_by),
    isDeleted: row.is_deleted == null ? 0 : Number(row.is_deleted),
  }
}

async function selectRoleById(connection, roleId) {
  const [rows] = await connection.query('SELECT * FROM sys_role WHERE role_id = ? LIMIT 1', [roleId])
  return rows.length ? mapRoleRow(rows[0]) : null
}

// 归一化创建时间区间：纯日期时补全到当天 00:00:00 / 23:59:59
function normalizeRangeTime(value, isEnd) {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return isEnd ? `${text} 23:59:59` : `${text} 00:00:00`
  }
  return text
}

// ── 查询接口 ──

export async function listRoles({
  page = 1,
  pageSize = 10,
  roleName = '',
  roleId = '',
  status = '',
  isDeleted = 0,
  startTime = '',
  endTime = '',
} = {}) {
  const pageNum = Math.max(1, toInt(page, 1))
  const sizeNum = Math.max(1, Math.min(100, toInt(pageSize, 10)))

  const where = []
  const params = []

  if (String(roleName || '').trim()) {
    // 左侧模糊：通配符在左侧，匹配以关键字结尾的角色名（LIKE '%关键字'）
    where.push('role_name LIKE ?')
    params.push(`%${String(roleName).trim()}`)
  }
  if (String(roleId || '').trim()) {
    where.push('role_id = ?')
    params.push(String(roleId).trim())
  }
  if (String(status || '').trim()) {
    where.push('role_status = ?')
    params.push(normalizeRoleStatus(status))
  }
  // 默认只查未删除（is_deleted=0）；空值/未传也视为未删除；显式传 1 才查已删除
  where.push('is_deleted = ?')
  params.push(isDeleted === '' || isDeleted == null ? 0 : normalizeDeletedFlag(isDeleted))
  const start = normalizeRangeTime(startTime, false)
  if (start) {
    where.push('created_at >= ?')
    params.push(start)
  }
  const end = normalizeRangeTime(endTime, true)
  if (end) {
    where.push('created_at <= ?')
    params.push(end)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  return withConnection(async (connection) => {
    await ensureRoleSchema(connection)
    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM sys_role ${whereSql}`, params)
    const total = Number(countRows[0]?.total || 0)
    const offset = (pageNum - 1) * sizeNum
    const [rows] = await connection.query(
      `SELECT * FROM sys_role ${whereSql} ORDER BY created_at DESC, role_id DESC LIMIT ? OFFSET ?`,
      [...params, sizeNum, offset],
    )
    return {
      ok: true,
      list: rows.map(mapRoleRow),
      total,
      page: pageNum,
      pageSize: sizeNum,
    }
  })
}

// ── 创建接口 ──

export async function createRole(input = {}) {
  const roleName = normalizeRoleName(input.roleName)
  const roleDescription = normalizeRoleDescription(input.roleDescription)
  const roleStatus = normalizeRoleStatus(input.roleStatus ?? input.status)
  const createdBy = normalizeRequiredText(input.createdBy ?? input.creator, '创建人')
  const menuPermissionIds = normalizePermissionValue(input.menuPermissionIds ?? input.menuPermissions, input.menuPermissionAll)
  const buttonPermissionIds = normalizePermissionValue(input.buttonPermissionIds ?? input.buttonPermissions, input.buttonPermissionAll)
  const storePermissionIds = normalizePermissionValue(input.storePermissionIds ?? input.storePermissions, input.storePermissionAll)

  return withConnection(async (connection) => {
    await ensureRoleSchema(connection)
    const roleId = await generateUniqueRoleId(connection)
    await connection.query(
      `INSERT INTO sys_role (
        role_id, role_name, role_description, role_status,
        menu_permission_ids, button_permission_ids, store_permission_ids,
        created_by, updated_by, is_deleted
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        roleId,
        roleName,
        roleDescription,
        roleStatus,
        menuPermissionIds,
        buttonPermissionIds,
        storePermissionIds,
        createdBy,
        createdBy,
        0,
      ],
    )
    const role = await selectRoleById(connection, roleId)
    return { ok: true, role }
  })
}

// ── 编辑接口 ──

export async function updateRole(input = {}) {
  const roleId = String(input.roleId ?? input.id ?? '').trim()
  if (!roleId) throw new ApiError('角色ID不可为空')
  const updatedBy = normalizeRequiredText(input.updatedBy ?? input.updater, '更新人')

  const sets = []
  const params = []

  if (input.roleName !== undefined && input.roleName !== null) {
    sets.push('role_name = ?')
    params.push(normalizeRoleName(input.roleName))
  }
  if (input.roleDescription !== undefined && input.roleDescription !== null) {
    sets.push('role_description = ?')
    params.push(normalizeRoleDescription(input.roleDescription))
  }
  if (input.roleStatus !== undefined || input.status !== undefined) {
    sets.push('role_status = ?')
    params.push(normalizeRoleStatus(input.roleStatus ?? input.status))
  }
  if (input.menuPermissionIds !== undefined || input.menuPermissions !== undefined || input.menuPermissionAll !== undefined) {
    sets.push('menu_permission_ids = ?')
    params.push(normalizePermissionValue(input.menuPermissionIds ?? input.menuPermissions, input.menuPermissionAll))
  }
  if (input.buttonPermissionIds !== undefined || input.buttonPermissions !== undefined || input.buttonPermissionAll !== undefined) {
    sets.push('button_permission_ids = ?')
    params.push(normalizePermissionValue(input.buttonPermissionIds ?? input.buttonPermissions, input.buttonPermissionAll))
  }
  if (input.storePermissionIds !== undefined || input.storePermissions !== undefined || input.storePermissionAll !== undefined) {
    sets.push('store_permission_ids = ?')
    params.push(normalizePermissionValue(input.storePermissionIds ?? input.storePermissions, input.storePermissionAll))
  }
  if (input.isDeleted !== undefined && input.isDeleted !== null && input.isDeleted !== '') {
    sets.push('is_deleted = ?')
    params.push(normalizeDeletedFlag(input.isDeleted))
  }

  if (!sets.length) throw new ApiError('没有需要更新的字段')
  sets.push('updated_by = ?')
  params.push(updatedBy)

  return withConnection(async (connection) => {
    await ensureRoleSchema(connection)
    const [result] = await connection.query(
      `UPDATE sys_role SET ${sets.join(', ')} WHERE role_id = ?`,
      [...params, roleId],
    )
    if (result.affectedRows === 0 && !(await selectRoleById(connection, roleId))) {
      throw new ApiError('角色不存在', 404)
    }
    const role = await selectRoleById(connection, roleId)
    return { ok: true, role }
  })
}

// ── 删除接口（软删除：置 is_deleted=1） ──

export async function deleteRole(input = {}) {
  const roleId = String(input.roleId ?? input.id ?? '').trim()
  if (!roleId) throw new ApiError('角色ID不可为空')
  const updatedBy = input.updatedBy == null ? '' : String(input.updatedBy).trim()

  return withConnection(async (connection) => {
    await ensureRoleSchema(connection)
    const [result] = await connection.query(
      'UPDATE sys_role SET is_deleted = 1, updated_by = ? WHERE role_id = ? AND is_deleted = 0',
      [updatedBy || null, roleId],
    )
    if (result.affectedRows === 0) {
      const exists = await selectRoleById(connection, roleId)
      if (!exists) throw new ApiError('角色不存在', 404)
    }
    const role = await selectRoleById(connection, roleId)
    return { ok: true, role }
  })
}
