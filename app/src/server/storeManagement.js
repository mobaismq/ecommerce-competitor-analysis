import crypto from 'crypto'
import mysql from 'mysql2/promise'

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

const STORE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sys_store (
    store_id VARCHAR(10) NOT NULL COMMENT '店铺ID（10位字母+数字）',
    platform_id VARCHAR(5) NULL COMMENT '所属平台ID',
    store_name VARCHAR(100) NOT NULL COMMENT '店铺名称',
    platform_store_id VARCHAR(64) NOT NULL COMMENT '平台店铺ID',
    store_logo VARCHAR(255) NULL COMMENT '店铺logo',
    auth_status TINYINT NOT NULL DEFAULT 1 COMMENT '授权状态：0已到期 1正常',
    store_status TINYINT NOT NULL DEFAULT 1 COMMENT '店铺状态：1启用 0停用',
    auth_time DATETIME NULL COMMENT '授权时间',
    auth_expire_time DATETIME NULL COMMENT '授权到期时间',
    auth_by VARCHAR(64) NULL COMMENT '授权人（账号ID）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '新增时间',
    created_by VARCHAR(64) NOT NULL COMMENT '新增操作人（账号ID）',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '删除状态：0未删除 1已删除',
    PRIMARY KEY (store_id),
    KEY idx_sys_store_name (store_name),
    KEY idx_sys_store_platform (platform_id),
    KEY idx_sys_store_platform_store_id (platform_store_id),
    KEY idx_sys_store_status (store_status),
    KEY idx_sys_store_auth_status (auth_status),
    KEY idx_sys_store_deleted (is_deleted),
    KEY idx_sys_store_auth_time (auth_time)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店铺表'`,
]

async function ensureStoreSchema(connection) {
  for (const statement of STORE_SCHEMA_STATEMENTS) {
    await connection.query(statement)
  }
  await migratePlatformId(connection)
}

// 迁移：已有表补加 platform_id 列，并按平台店铺ID前缀回填所属平台
async function migratePlatformId(connection) {
  const [columns] = await connection.query("SHOW COLUMNS FROM sys_store LIKE 'platform_id'")
  if (columns.length > 0) return
  await connection.query("ALTER TABLE sys_store ADD COLUMN platform_id VARCHAR(5) NULL COMMENT '所属平台ID' AFTER store_id")
  await connection.query("UPDATE sys_store SET platform_id = '10001' WHERE platform_store_id LIKE 'TAOBAO%' AND platform_id IS NULL")
  await connection.query("UPDATE sys_store SET platform_id = '10002' WHERE platform_store_id LIKE 'TM%' AND platform_id IS NULL")
  await connection.query("UPDATE sys_store SET platform_id = '10003' WHERE platform_store_id LIKE 'JD%' AND platform_id IS NULL")
  await connection.query("UPDATE sys_store SET platform_id = '10004' WHERE platform_store_id LIKE 'PDD%' AND platform_id IS NULL")
  await connection.query("UPDATE sys_store SET platform_id = '10005' WHERE platform_store_id LIKE 'DOUDIAN%' AND platform_id IS NULL")
}

// ── 工具函数 ──

const STORE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// 生成 10 位字母+数字 的店铺ID
function generateStoreId() {
  let id = ''
  for (let i = 0; i < 10; i += 1) {
    id += STORE_ID_ALPHABET[crypto.randomInt(STORE_ID_ALPHABET.length)]
  }
  return id
}

async function generateUniqueStoreId(connection) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const storeId = generateStoreId()
    const [rows] = await connection.query('SELECT 1 AS hit FROM sys_store WHERE store_id = ? LIMIT 1', [storeId])
    if (rows.length === 0) return storeId
  }
  throw new ApiError('店铺ID生成失败，请重试', 500)
}

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function normalizeRequiredText(value, label) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError(`${label}不可为空`)
  return text
}

// 店铺名称：非空
function normalizeStoreName(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError('店铺名称不可为空')
  if (text.length > 100) throw new ApiError('店铺名称最多100个字符')
  return text
}

// 平台店铺ID：非空
function normalizePlatformStoreId(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError('店铺平台ID不可为空')
  return text
}

// 授权状态：0已到期 1正常
function normalizeAuthStatus(value) {
  if (value == null || String(value).trim() === '') return 1
  const text = String(value).trim()
  if (text === '1' || text === '正常' || text === 'enabled' || text === 'active') return 1
  if (text === '0' || text === '已到期' || text === 'expired') return 0
  throw new ApiError('授权状态仅支持1（正常）或0（已到期）')
}

// 店铺状态：1启用 0停用，默认启用(1)
function normalizeStoreStatus(value) {
  if (value == null || String(value).trim() === '') return 1
  const text = String(value).trim()
  if (text === '1' || text === '启用' || text === 'enabled' || text === 'active') return 1
  if (text === '0' || text === '停用' || text === 'disabled' || text === 'inactive') return 0
  throw new ApiError('店铺状态仅支持1（启用）或0（停用）')
}

function normalizeDeletedFlag(value) {
  if (value == null || value === '') return 0
  if (value === 1 || value === '1' || value === true || value === 'true') return 1
  if (value === 0 || value === '0' || value === false || value === 'false') return 0
  throw new ApiError('删除状态仅支持0或1')
}

function mapStoreRow(row) {
  if (!row) return null
  return {
    storeId: String(row.store_id || ''),
    storeName: String(row.store_name || ''),
    platformId: row.platform_id == null ? '' : String(row.platform_id),
    platformName: row.platform_name == null ? '' : String(row.platform_name),
    platformLogo: row.platform_logo == null ? '' : String(row.platform_logo),
    platformStoreId: String(row.platform_store_id || ''),
    storeLogo: row.store_logo == null ? '' : String(row.store_logo),
    authStatus: row.auth_status == null ? 1 : Number(row.auth_status),
    storeStatus: row.store_status == null ? 1 : Number(row.store_status),
    authTime: row.auth_time == null ? '' : String(row.auth_time),
    authExpireTime: row.auth_expire_time == null ? '' : String(row.auth_expire_time),
    authBy: row.auth_by == null ? '' : String(row.auth_by),
    createdAt: row.created_at == null ? '' : String(row.created_at),
    createdBy: row.created_by == null ? '' : String(row.created_by),
    isDeleted: row.is_deleted == null ? 0 : Number(row.is_deleted),
  }
}

// 查询店铺（带所属平台名称；授权状态根据授权到期时间动态计算）
async function selectStoreWithPlatform(connection, storeId) {
  const [rows] = await connection.query(
    `SELECT s.*, p.platform_name AS platform_name, p.platform_logo AS platform_logo,
       CASE WHEN s.auth_expire_time IS NOT NULL AND s.auth_expire_time < NOW() THEN 0 ELSE 1 END AS auth_status
     FROM sys_store s
     LEFT JOIN sys_platform p ON s.platform_id = p.platform_id
     WHERE s.store_id = ? LIMIT 1`,
    [storeId],
  )
  return rows.length ? mapStoreRow(rows[0]) : null
}

async function selectStoreById(connection, storeId) {
  const [rows] = await connection.query('SELECT * FROM sys_store WHERE store_id = ? LIMIT 1', [storeId])
  return rows.length ? mapStoreRow(rows[0]) : null
}

// 归一化时间：纯日期补全到当天 00:00:00 / 23:59:59
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

export async function listStores({
  page = 1,
  pageSize = 10,
  storeName = '',
  storeId = '',
  storeIds = '',
  platformId = '',
  platformStoreId = '',
  status = '',
  authStatus = '',
  isDeleted = 0,
  authTimeStart = '',
  authTimeEnd = '',
  authExpireTimeStart = '',
  authExpireTimeEnd = '',
} = {}) {
  const pageNum = Math.max(1, toInt(page, 1))
  const sizeNum = Math.max(1, Math.min(100, toInt(pageSize, 10)))

  const where = []
  const params = []

  if (String(storeName || '').trim()) {
    // 店铺名称模糊查询（全模糊）
    where.push('s.store_name LIKE ?')
    params.push(`%${String(storeName).trim()}%`)
  }
  if (String(storeId || '').trim()) {
    where.push('s.store_id = ?')
    params.push(String(storeId).trim())
  }
  // 店铺ID集合过滤（账号店铺权限）：支持逗号分隔字符串或数组
  const storeIdList = Array.isArray(storeIds)
    ? storeIds.map((id) => String(id).trim()).filter(Boolean)
    : String(storeIds || '').split(',').map((id) => id.trim()).filter(Boolean)
  if (storeIdList.length) {
    where.push(`s.store_id IN (${storeIdList.map(() => '?').join(', ')})`)
    params.push(...storeIdList)
  }
  if (String(platformId || '').trim()) {
    where.push('s.platform_id = ?')
    params.push(String(platformId).trim())
  }
  if (String(platformStoreId || '').trim()) {
    where.push('s.platform_store_id = ?')
    params.push(String(platformStoreId).trim())
  }
  if (String(status || '').trim()) {
    where.push('s.store_status = ?')
    params.push(normalizeStoreStatus(status))
  }
  if (String(authStatus || '').trim()) {
    where.push('s.auth_status = ?')
    params.push(normalizeAuthStatus(authStatus))
  }
  // 默认只查未删除
  where.push('s.is_deleted = ?')
  params.push(isDeleted === '' || isDeleted == null ? 0 : normalizeDeletedFlag(isDeleted))

  const authTimeS = normalizeRangeTime(authTimeStart, false)
  if (authTimeS) {
    where.push('s.auth_time >= ?')
    params.push(authTimeS)
  }
  const authTimeE = normalizeRangeTime(authTimeEnd, true)
  if (authTimeE) {
    where.push('s.auth_time <= ?')
    params.push(authTimeE)
  }
  const expireS = normalizeRangeTime(authExpireTimeStart, false)
  if (expireS) {
    where.push('s.auth_expire_time >= ?')
    params.push(expireS)
  }
  const expireE = normalizeRangeTime(authExpireTimeEnd, true)
  if (expireE) {
    where.push('s.auth_expire_time <= ?')
    params.push(expireE)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  return withConnection(async (connection) => {
    await ensureStoreSchema(connection)
    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total FROM sys_store s LEFT JOIN sys_platform p ON s.platform_id = p.platform_id ${whereSql}`,
      params,
    )
    const total = Number(countRows[0]?.total || 0)
    const offset = (pageNum - 1) * sizeNum
    const [rows] = await connection.query(
      `SELECT s.*, p.platform_name AS platform_name, p.platform_logo AS platform_logo,
         CASE WHEN s.auth_expire_time IS NOT NULL AND s.auth_expire_time < NOW() THEN 0 ELSE 1 END AS auth_status
       FROM sys_store s
       LEFT JOIN sys_platform p ON s.platform_id = p.platform_id
       ${whereSql}
       ORDER BY s.created_at DESC, s.store_id DESC LIMIT ? OFFSET ?`,
      [...params, sizeNum, offset],
    )
    return {
      ok: true,
      list: rows.map(mapStoreRow),
      total,
      page: pageNum,
      pageSize: sizeNum,
    }
  })
}

// ── 新增店铺接口 ──

export async function createStore(input = {}) {
  const storeName = normalizeStoreName(input.storeName)
  const platformId = normalizeRequiredText(input.platformId ?? input.platformID, '所属平台')
  const platformStoreId = normalizePlatformStoreId(input.platformStoreId ?? input.platformStoreID)
  const storeLogo = input.storeLogo == null ? '' : String(input.storeLogo).trim()
  const authStatus = normalizeAuthStatus(input.authStatus)
  const storeStatus = normalizeStoreStatus(input.storeStatus ?? input.status)
  const authTime = normalizeRequiredText(input.authTime, '授权时间')
  const authExpireTime = normalizeRequiredText(input.authExpireTime, '授权到期时间')
  const authBy = normalizeRequiredText(input.authBy, '授权人')
  const createdBy = normalizeRequiredText(input.createdBy ?? input.creator, '新增操作人')

  return withConnection(async (connection) => {
    await ensureStoreSchema(connection)
    const storeId = await generateUniqueStoreId(connection)
    await connection.query(
      `INSERT INTO sys_store (
        store_id, platform_id, store_name, platform_store_id, store_logo, auth_status, store_status,
        auth_time, auth_expire_time, auth_by, created_by, is_deleted
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        storeId,
        platformId,
        storeName,
        platformStoreId,
        storeLogo,
        authStatus,
        storeStatus,
        authTime,
        authExpireTime,
        authBy,
        createdBy,
        0,
      ],
    )
    const store = await selectStoreWithPlatform(connection, storeId)
    return { ok: true, store }
  })
}

// ── 编辑店铺接口 ──

export async function updateStore(input = {}) {
  const storeId = String(input.storeId ?? input.id ?? '').trim()
  if (!storeId) throw new ApiError('店铺ID不可为空')

  const sets = []
  const params = []

  if (input.storeName !== undefined && input.storeName !== null) {
    sets.push('store_name = ?')
    params.push(normalizeStoreName(input.storeName))
  }
  if (input.platformId !== undefined && input.platformId !== null) {
    sets.push('platform_id = ?')
    params.push(String(input.platformId).trim())
  }
  if (input.storeLogo !== undefined && input.storeLogo !== null) {
    sets.push('store_logo = ?')
    params.push(String(input.storeLogo).trim())
  }
  if (input.authStatus !== undefined && input.authStatus !== null) {
    sets.push('auth_status = ?')
    params.push(normalizeAuthStatus(input.authStatus))
  }
  if (input.storeStatus !== undefined || input.status !== undefined) {
    sets.push('store_status = ?')
    params.push(normalizeStoreStatus(input.storeStatus ?? input.status))
  }
  if (input.authTime !== undefined && input.authTime !== null) {
    sets.push('auth_time = ?')
    params.push(normalizeRequiredText(input.authTime, '授权时间'))
  }
  if (input.authExpireTime !== undefined && input.authExpireTime !== null) {
    sets.push('auth_expire_time = ?')
    params.push(normalizeRequiredText(input.authExpireTime, '授权到期时间'))
  }
  if (input.authBy !== undefined && input.authBy !== null) {
    sets.push('auth_by = ?')
    params.push(normalizeRequiredText(input.authBy, '授权人'))
  }
  if (input.isDeleted !== undefined && input.isDeleted !== null && input.isDeleted !== '') {
    sets.push('is_deleted = ?')
    params.push(normalizeDeletedFlag(input.isDeleted))
  }

  if (!sets.length) throw new ApiError('没有需要更新的字段')

  return withConnection(async (connection) => {
    await ensureStoreSchema(connection)
    const [result] = await connection.query(
      `UPDATE sys_store SET ${sets.join(', ')} WHERE store_id = ?`,
      [...params, storeId],
    )
    if (result.affectedRows === 0 && !(await selectStoreById(connection, storeId))) {
      throw new ApiError('店铺不存在', 404)
    }
    const store = await selectStoreWithPlatform(connection, storeId)
    return { ok: true, store }
  })
}

// ── 删除接口（软删除） ──

export async function deleteStore(input = {}) {
  const storeId = String(input.storeId ?? input.id ?? '').trim()
  if (!storeId) throw new ApiError('店铺ID不可为空')

  return withConnection(async (connection) => {
    await ensureStoreSchema(connection)
    const [result] = await connection.query(
      'UPDATE sys_store SET is_deleted = 1 WHERE store_id = ? AND is_deleted = 0',
      [storeId],
    )
    if (result.affectedRows === 0) {
      const exists = await selectStoreById(connection, storeId)
      if (!exists) throw new ApiError('店铺不存在', 404)
    }
    const store = await selectStoreWithPlatform(connection, storeId)
    return { ok: true, store }
  })
}
