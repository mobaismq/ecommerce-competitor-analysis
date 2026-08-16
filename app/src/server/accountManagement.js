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

const ACCOUNT_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sys_account (
    account_id VARCHAR(20) NOT NULL COMMENT '账号ID（20位字母+数字，自动生成）',
    account_name VARCHAR(15) NOT NULL COMMENT '账号名称',
    phone VARCHAR(11) NOT NULL COMMENT '手机号（11位数字）',
    password VARCHAR(255) NOT NULL COMMENT '密码（加密存储）',
    account_status TINYINT NOT NULL DEFAULT 1 COMMENT '账号状态：1启用 0停用',
    department_id VARCHAR(10) NOT NULL COMMENT '所属部门ID',
    role_ids VARCHAR(500) NOT NULL COMMENT '关联角色ID（逗号分隔，可多个）',
    data_scope TINYINT NOT NULL DEFAULT 0 COMMENT '数据范围：0全部数据 1同部门创建数据 2仅自己创建数据',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    created_by VARCHAR(64) NOT NULL COMMENT '创建人',
    updated_by VARCHAR(64) NULL COMMENT '更新人',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '删除状态：0未删除 1已删除',
    PRIMARY KEY (account_id),
    KEY idx_sys_account_name (account_name),
    KEY idx_sys_account_phone (phone),
    KEY idx_sys_account_status (account_status),
    KEY idx_sys_account_dept (department_id),
    KEY idx_sys_account_deleted (is_deleted),
    KEY idx_sys_account_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账号表'`,
]

async function ensureAccountSchema(connection) {
  for (const statement of ACCOUNT_SCHEMA_STATEMENTS) {
    await connection.query(statement)
  }
  await migrateDataScope(connection)
}

// 历史数据迁移：把 data_scope 从文字转换为数字（0全部数据 1同部门创建数据 2仅自己创建数据）
async function migrateDataScope(connection) {
  const [columns] = await connection.query(
    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_account' AND COLUMN_NAME = 'data_scope'",
  )
  const dataType = columns[0]?.DATA_TYPE
  if (!dataType || /int/i.test(dataType)) return // 已是数字类型，无需迁移
  await connection.query("UPDATE sys_account SET data_scope = '0' WHERE data_scope IN ('全部数据','all')")
  await connection.query("UPDATE sys_account SET data_scope = '1' WHERE data_scope IN ('同部门创建数据','dept')")
  await connection.query("UPDATE sys_account SET data_scope = '2' WHERE data_scope IN ('仅自己创建数据','self')")
  await connection.query("ALTER TABLE sys_account MODIFY COLUMN data_scope TINYINT NOT NULL DEFAULT 0 COMMENT '数据范围：0全部数据 1同部门创建数据 2仅自己创建数据'")
}

// ── 工具函数 ──

const ACCOUNT_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// 生成 20 位字母+数字 的账号ID
function generateAccountId() {
  let id = ''
  for (let i = 0; i < 20; i += 1) {
    id += ACCOUNT_ID_ALPHABET[crypto.randomInt(ACCOUNT_ID_ALPHABET.length)]
  }
  return id
}

async function generateUniqueAccountId(connection) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const accountId = generateAccountId()
    const [rows] = await connection.query('SELECT 1 AS hit FROM sys_account WHERE account_id = ? LIMIT 1', [accountId])
    if (rows.length === 0) return accountId
  }
  throw new ApiError('账号ID生成失败，请重试', 500)
}

// 密码加密：scrypt + 随机盐，存储格式 salt:hash（不可逆）
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

// 校验密码（供后续登录使用）
export function verifyPassword(password, stored) {
  if (!stored || !String(stored).includes(':')) return false
  const [salt, hash] = String(stored).split(':')
  const computed = crypto.scryptSync(password, salt, 64).toString('hex')
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(computed, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

// 账号名称：非空 + 最多15字符
function normalizeAccountName(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError('账号名称不可为空')
  if (text.length > 15) throw new ApiError('账号名称最多15个字符')
  return text
}

// 手机号：非空 + 11位数字
function normalizePhone(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError('手机号不可为空')
  if (!/^\d{11}$/.test(text)) throw new ApiError('手机号格式错误')
  return text
}

// 密码：非空 + 6-20位字母/数字/特殊字符（ASCII 可打印字符，不含空格）
function normalizePassword(value) {
  const text = value == null ? '' : String(value)
  if (!text) throw new ApiError('密码不可为空')
  if (!/^[\x21-\x7E]{6,20}$/.test(text)) throw new ApiError('密码格式错误')
  return text
}

// 所属部门：非空
function normalizeDepartmentId(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError('部门不可为空')
  return text
}

// 关联角色：非空，可多个（逗号分隔）
function normalizeRoleIds(value) {
  let result = ''
  if (Array.isArray(value)) {
    result = value.map((v) => String(v ?? '').trim()).filter((v) => v !== '').join(',')
  } else if (value != null && String(value).trim() !== '') {
    result = String(value).trim()
  }
  if (!result) throw new ApiError('角色不可为空')
  return result
}

// 数据范围：非空，0全部数据 1同部门创建数据 2仅自己创建数据
function normalizeDataScope(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError('数据范围不可为空')
  if (text === '0' || text === '全部数据' || text === 'all') return 0
  if (text === '1' || text === '同部门创建数据' || text === 'dept') return 1
  if (text === '2' || text === '仅自己创建数据' || text === 'self') return 2
  throw new ApiError('数据范围格式错误')
}

// 账号状态：1启用 0停用，默认启用(1)
function normalizeAccountStatus(value) {
  if (value == null || String(value).trim() === '') return 1
  const text = String(value).trim()
  if (text === '1' || text === '启用' || text === 'enabled' || text === 'active') return 1
  if (text === '0' || text === '停用' || text === 'disabled' || text === 'inactive') return 0
  throw new ApiError('账号状态仅支持1（启用）或0（停用）')
}

function normalizeRequiredText(value, label) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError(`${label}不可为空`)
  return text
}

function normalizeDeletedFlag(value) {
  if (value == null || value === '') return 0
  if (value === 1 || value === '1' || value === true || value === 'true') return 1
  if (value === 0 || value === '0' || value === false || value === 'false') return 0
  throw new ApiError('删除状态仅支持0或1')
}

// 逗号分隔字符串 → 字符串数组
function parseCsv(value) {
  if (value == null || value === '') return []
  return String(value).split(',').map((s) => s.trim()).filter((s) => s !== '')
}

function mapAccountRow(row) {
  if (!row) return null
  return {
    accountId: String(row.account_id || ''),
    accountName: String(row.account_name || ''),
    phone: String(row.phone || ''),
    accountStatus: row.account_status == null ? 1 : Number(row.account_status),
    departmentId: row.department_id == null ? '' : String(row.department_id),
    roleIds: parseCsv(row.role_ids),
    dataScope: row.data_scope == null ? 0 : Number(row.data_scope),
    createdAt: row.created_at == null ? '' : String(row.created_at),
    updatedAt: row.updated_at == null ? '' : String(row.updated_at),
    createdBy: row.created_by == null ? '' : String(row.created_by),
    updatedBy: row.updated_by == null ? '' : String(row.updated_by),
    isDeleted: row.is_deleted == null ? 0 : Number(row.is_deleted),
  }
}

async function selectAccountById(connection, accountId) {
  const [rows] = await connection.query('SELECT * FROM sys_account WHERE account_id = ? LIMIT 1', [accountId])
  return rows.length ? mapAccountRow(rows[0]) : null
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

export async function listAccounts({
  page = 1,
  pageSize = 10,
  accountName = '',
  phone = '',
  roleId = '',
  status = '',
  isDeleted = 0,
  departmentId = '',
  departmentIds = '',
  startTime = '',
  endTime = '',
} = {}) {
  const pageNum = Math.max(1, toInt(page, 1))
  const sizeNum = Math.max(1, Math.min(100, toInt(pageSize, 10)))

  const where = []
  const params = []

  if (String(accountName || '').trim()) {
    // 左侧模糊：通配符在左侧，匹配以关键字结尾的账号名（LIKE '%关键字'）
    where.push('account_name LIKE ?')
    params.push(`%${String(accountName).trim()}`)
  }
  if (String(phone || '').trim()) {
    // 手机号左侧模糊
    where.push('phone LIKE ?')
    params.push(`%${String(phone).trim()}`)
  }
  if (String(roleId || '').trim()) {
    // 角色ID精准查询：关联角色（逗号分隔）中包含该角色
    where.push('FIND_IN_SET(?, role_ids)')
    params.push(String(roleId).trim())
  }
  if (String(status || '').trim()) {
    where.push('account_status = ?')
    params.push(normalizeAccountStatus(status))
  }
  // 默认只查未删除（is_deleted=0）；空值/未传也视为未删除；显式传 1 才查已删除
  where.push('is_deleted = ?')
  params.push(isDeleted === '' || isDeleted == null ? 0 : normalizeDeletedFlag(isDeleted))
  if (String(departmentId || '').trim()) {
    where.push('department_id = ?')
    params.push(String(departmentId).trim())
  }
  if (String(departmentIds || '').trim()) {
    const ids = String(departmentIds).split(',').map((s) => s.trim()).filter((s) => s !== '')
    if (ids.length) {
      where.push(`department_id IN (${ids.map(() => '?').join(', ')})`)
      params.push(...ids)
    }
  }
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
    await ensureAccountSchema(connection)
    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM sys_account ${whereSql}`, params)
    const total = Number(countRows[0]?.total || 0)
    const offset = (pageNum - 1) * sizeNum
    const [rows] = await connection.query(
      `SELECT * FROM sys_account ${whereSql} ORDER BY created_at DESC, account_id DESC LIMIT ? OFFSET ?`,
      [...params, sizeNum, offset],
    )
    return {
      ok: true,
      list: rows.map(mapAccountRow),
      total,
      page: pageNum,
      pageSize: sizeNum,
    }
  })
}

// ── 创建接口 ──

export async function createAccount(input = {}) {
  const accountName = normalizeAccountName(input.accountName)
  const phone = normalizePhone(input.phone)
  const password = normalizePassword(input.password)
  const departmentId = normalizeDepartmentId(input.departmentId ?? input.deptId)
  const roleIds = normalizeRoleIds(input.roleIds ?? input.roles)
  const dataScope = normalizeDataScope(input.dataScope)
  const accountStatus = normalizeAccountStatus(input.accountStatus ?? input.status)
  const createdBy = normalizeRequiredText(input.createdBy ?? input.creator, '创建人')

  return withConnection(async (connection) => {
    await ensureAccountSchema(connection)
    const accountId = await generateUniqueAccountId(connection)
    await connection.query(
      `INSERT INTO sys_account (
        account_id, account_name, phone, password, account_status,
        department_id, role_ids, data_scope,
        created_by, updated_by, is_deleted
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        accountId,
        accountName,
        phone,
        hashPassword(password),
        accountStatus,
        departmentId,
        roleIds,
        dataScope,
        createdBy,
        createdBy,
        0,
      ],
    )
    const account = await selectAccountById(connection, accountId)
    return { ok: true, account }
  })
}

// ── 编辑接口 ──

export async function updateAccount(input = {}) {
  const accountId = String(input.accountId ?? input.id ?? '').trim()
  if (!accountId) throw new ApiError('账号ID不可为空')
  const updatedBy = normalizeRequiredText(input.updatedBy ?? input.updater, '更新人')

  const sets = []
  const params = []

  if (input.accountName !== undefined && input.accountName !== null) {
    sets.push('account_name = ?')
    params.push(normalizeAccountName(input.accountName))
  }
  if (input.departmentId !== undefined || input.deptId !== undefined) {
    sets.push('department_id = ?')
    params.push(normalizeDepartmentId(input.departmentId ?? input.deptId))
  }
  if (input.roleIds !== undefined || input.roles !== undefined) {
    sets.push('role_ids = ?')
    params.push(normalizeRoleIds(input.roleIds ?? input.roles))
  }
  if (input.dataScope !== undefined && input.dataScope !== null) {
    sets.push('data_scope = ?')
    params.push(normalizeDataScope(input.dataScope))
  }
  if (input.accountStatus !== undefined || input.status !== undefined) {
    sets.push('account_status = ?')
    params.push(normalizeAccountStatus(input.accountStatus ?? input.status))
  }
  if (input.isDeleted !== undefined && input.isDeleted !== null && input.isDeleted !== '') {
    sets.push('is_deleted = ?')
    params.push(normalizeDeletedFlag(input.isDeleted))
  }

  if (!sets.length) throw new ApiError('没有需要更新的字段')
  sets.push('updated_by = ?')
  params.push(updatedBy)

  return withConnection(async (connection) => {
    await ensureAccountSchema(connection)
    const [result] = await connection.query(
      `UPDATE sys_account SET ${sets.join(', ')} WHERE account_id = ?`,
      [...params, accountId],
    )
    if (result.affectedRows === 0 && !(await selectAccountById(connection, accountId))) {
      throw new ApiError('账号不存在', 404)
    }
    const account = await selectAccountById(connection, accountId)
    return { ok: true, account }
  })
}

// ── 删除接口（软删除：置 is_deleted=1） ──

export async function deleteAccount(input = {}) {
  const accountId = String(input.accountId ?? input.id ?? '').trim()
  if (!accountId) throw new ApiError('账号ID不可为空')
  const updatedBy = input.updatedBy == null ? '' : String(input.updatedBy).trim()

  return withConnection(async (connection) => {
    await ensureAccountSchema(connection)
    const [result] = await connection.query(
      'UPDATE sys_account SET is_deleted = 1, updated_by = ? WHERE account_id = ? AND is_deleted = 0',
      [updatedBy || null, accountId],
    )
    if (result.affectedRows === 0) {
      const exists = await selectAccountById(connection, accountId)
      if (!exists) throw new ApiError('账号不存在', 404)
    }
    const account = await selectAccountById(connection, accountId)
    return { ok: true, account }
  })
}

// ── 修改密码接口 ──

export async function changeAccountPassword(input = {}) {
  const accountId = String(input.accountId ?? input.id ?? '').trim()
  if (!accountId) throw new ApiError('账号ID不可为空')
  const password = normalizePassword(input.password)
  const updatedBy = input.updatedBy == null ? '' : String(input.updatedBy).trim()

  return withConnection(async (connection) => {
    await ensureAccountSchema(connection)
    const [result] = await connection.query(
      'UPDATE sys_account SET password = ?, updated_by = ? WHERE account_id = ?',
      [hashPassword(password), updatedBy || null, accountId],
    )
    if (result.affectedRows === 0 && !(await selectAccountById(connection, accountId))) {
      throw new ApiError('账号不存在', 404)
    }
    const account = await selectAccountById(connection, accountId)
    return { ok: true, account }
  })
}

// ── 登录接口 ──

// 查询账号关联角色的菜单/按钮/店铺权限并集
async function resolvePermissions(connection, roleIds) {
  const menuSet = new Set()
  const buttonSet = new Set()
  const storeSet = new Set()
  let menuAll = false
  let buttonAll = false
  let storeAll = false
  if (roleIds && roleIds.length) {
    const placeholders = roleIds.map(() => '?').join(', ')
    const [roles] = await connection.query(
      `SELECT menu_permission_ids, button_permission_ids, store_permission_ids FROM sys_role WHERE role_id IN (${placeholders}) AND is_deleted = 0`,
      roleIds,
    )
    for (const role of roles) {
      for (const id of parseCsv(role.menu_permission_ids)) {
        if (id === '*') menuAll = true
        else {
          const n = Number(id)
          if (Number.isFinite(n)) menuSet.add(n)
        }
      }
      for (const id of parseCsv(role.button_permission_ids)) {
        if (id === '*') buttonAll = true
        else {
          const n = Number(id)
          if (Number.isFinite(n)) buttonSet.add(n)
        }
      }
      for (const id of parseCsv(role.store_permission_ids)) {
        if (id === '*') storeAll = true
        else if (id) storeSet.add(id)
      }
    }
  }
  // 全选角色：展开为当前全部权限（未来新增项在登录/刷新时重新解析自动包含）
  if (menuAll) {
    try {
      const [menus] = await connection.query('SELECT menu_id FROM sys_menu')
      for (const m of menus) menuSet.add(Number(m.menu_id))
    } catch {}
  }
  if (buttonAll) {
    try {
      const [buttons] = await connection.query('SELECT button_id FROM sys_button')
      for (const b of buttons) buttonSet.add(Number(b.button_id))
    } catch {}
  }
  if (storeAll) {
    try {
      const [stores] = await connection.query('SELECT store_id FROM sys_store WHERE is_deleted = 0')
      for (const s of stores) storeSet.add(String(s.store_id))
    } catch {}
  }
  return {
    menuPermissionIds: Array.from(menuSet),
    buttonPermissionIds: Array.from(buttonSet),
    storePermissionIds: Array.from(storeSet),
  }
}

export async function loginAccount(input = {}) {
  const account = String(input.account ?? input.accountName ?? input.phone ?? '').trim()
  const password = input.password == null ? '' : String(input.password)
  if (!account) throw new ApiError('请输入账号或手机号')
  if (!password) throw new ApiError('请输入密码')

  return withConnection(async (connection) => {
    await ensureAccountSchema(connection)
    // 账号名称或手机号均可登录；只查未删除账号
    const [rows] = await connection.query(
      'SELECT * FROM sys_account WHERE (account_name = ? OR phone = ?) AND is_deleted = 0 LIMIT 1',
      [account, account],
    )
    if (rows.length === 0) throw new ApiError('账号或密码错误')
    const row = rows[0]
    if (!verifyPassword(password, row.password)) throw new ApiError('账号或密码错误')
    if (Number(row.account_status) === 0) throw new ApiError('账号已停用')

    const permissions = await resolvePermissions(connection, parseCsv(row.role_ids))
    return { ok: true, account: mapAccountRow(row), permissions }
  })
}

// ── 查询账号权限接口（登录后刷新权限，无需重新登录） ──

export async function getAccountPermissions(input = {}) {
  const account = String(input.account ?? input.accountName ?? '').trim()
  if (!account) throw new ApiError('账号不可为空')

  return withConnection(async (connection) => {
    await ensureAccountSchema(connection)
    const [rows] = await connection.query(
      'SELECT * FROM sys_account WHERE account_name = ? AND is_deleted = 0 LIMIT 1',
      [account],
    )
    if (rows.length === 0) {
      return { ok: true, permissions: { menuPermissionIds: [], buttonPermissionIds: [], storePermissionIds: [] } }
    }
    const permissions = await resolvePermissions(connection, parseCsv(rows[0].role_ids))
    return { ok: true, permissions }
  })
}
