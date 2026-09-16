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

const PLATFORM_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sys_platform (
    platform_id VARCHAR(5) NOT NULL COMMENT '平台ID（5位数字）',
    platform_name VARCHAR(50) NOT NULL COMMENT '平台名称',
    platform_code VARCHAR(20) NOT NULL COMMENT '平台编码',
    platform_logo VARCHAR(255) NULL COMMENT '平台logo',
    platform_status TINYINT NOT NULL DEFAULT 1 COMMENT '平台状态：1启用 0停用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    created_by VARCHAR(64) NOT NULL COMMENT '创建人',
    updated_by VARCHAR(64) NULL COMMENT '更新人',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '删除状态：0未删除 1已删除',
    PRIMARY KEY (platform_id),
    KEY idx_sys_platform_name (platform_name),
    KEY idx_sys_platform_code (platform_code),
    KEY idx_sys_platform_status (platform_status),
    KEY idx_sys_platform_deleted (is_deleted),
    KEY idx_sys_platform_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台表'`,
]

// 平台种子数据：ID 5位数字，编码 TAOBAO/TM/JD/PDD/DOUDIAN，logo 用 public 目录下的图片
const PLATFORM_SEED = [
  [10001, '淘宝', 'TAOBAO', '/platform/taobao.png', 1],
  [10002, '天猫', 'TM', '/platform/tmall.png', 1],
  [10003, '京东', 'JD', '/platform/jd.png', 1],
  [10004, '拼多多', 'PDD', '/platform/pdd.png', 1],
  [10005, '抖店', 'DOUDIAN', '/platform/doudian.png', 1],
]

async function ensurePlatformSchema(connection) {
  for (const statement of PLATFORM_SCHEMA_STATEMENTS) {
    await connection.query(statement)
  }
  for (const p of PLATFORM_SEED) {
    await connection.query(
      'INSERT IGNORE INTO sys_platform (platform_id, platform_name, platform_code, platform_logo, platform_status) VALUES (?,?,?,?,?)',
      p,
    )
  }
}

// ── 工具函数 ──

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function normalizeRequiredText(value, label) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError(`${label}不可为空`)
  return text
}

function normalizePlatformName(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError('平台名称不可为空')
  if (text.length > 50) throw new ApiError('平台名称最多50个字符')
  return text
}

function normalizePlatformCode(value) {
  const text = value == null ? '' : String(value).trim()
  if (!text) throw new ApiError('平台编码不可为空')
  if (text.length > 20) throw new ApiError('平台编码最多20个字符')
  return text
}

function normalizePlatformStatus(value) {
  if (value == null || String(value).trim() === '') return 1
  const text = String(value).trim()
  if (text === '1' || text === '启用' || text === 'enabled' || text === 'active') return 1
  if (text === '0' || text === '停用' || text === 'disabled' || text === 'inactive') return 0
  throw new ApiError('平台状态仅支持1（启用）或0（停用）')
}

function normalizeDeletedFlag(value) {
  if (value == null || value === '') return 0
  if (value === 1 || value === '1' || value === true || value === 'true') return 1
  if (value === 0 || value === '0' || value === false || value === 'false') return 0
  throw new ApiError('删除状态仅支持0或1')
}

function mapPlatformRow(row) {
  if (!row) return null
  return {
    platformId: String(row.platform_id || ''),
    platformName: String(row.platform_name || ''),
    platformCode: String(row.platform_code || ''),
    platformLogo: row.platform_logo == null ? '' : String(row.platform_logo),
    platformStatus: row.platform_status == null ? 1 : Number(row.platform_status),
    createdAt: row.created_at == null ? '' : String(row.created_at),
    updatedAt: row.updated_at == null ? '' : String(row.updated_at),
    createdBy: row.created_by == null ? '' : String(row.created_by),
    updatedBy: row.updated_by == null ? '' : String(row.updated_by),
    isDeleted: row.is_deleted == null ? 0 : Number(row.is_deleted),
  }
}

async function selectPlatformById(connection, platformId) {
  const [rows] = await connection.query('SELECT * FROM sys_platform WHERE platform_id = ? LIMIT 1', [platformId])
  return rows.length ? mapPlatformRow(rows[0]) : null
}

// 生成新的平台ID（5位数字，基于当前最大ID+1，初始从 10001 起）
async function generatePlatformId(connection) {
  const [rows] = await connection.query('SELECT MAX(platform_id) AS maxId FROM sys_platform')
  const maxId = toInt(rows[0]?.maxId, 10000)
  return String(Math.max(10000, maxId) + 1)
}

// 归一化创建时间区间
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

export async function listPlatforms({
  page = 1,
  pageSize = 10,
  platformName = '',
  platformId = '',
  status = '',
  isDeleted = 0,
  startTime = '',
  endTime = '',
} = {}) {
  const pageNum = Math.max(1, toInt(page, 1))
  const sizeNum = Math.max(1, Math.min(100, toInt(pageSize, 10)))

  const where = []
  const params = []

  if (String(platformName || '').trim()) {
    // 平台名称精准查询
    where.push('platform_name = ?')
    params.push(String(platformName).trim())
  }
  if (String(platformId || '').trim()) {
    where.push('platform_id = ?')
    params.push(String(platformId).trim())
  }
  if (String(status || '').trim()) {
    where.push('platform_status = ?')
    params.push(normalizePlatformStatus(status))
  }
  // 默认只查未删除
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
    await ensurePlatformSchema(connection)
    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM sys_platform ${whereSql}`, params)
    const total = Number(countRows[0]?.total || 0)
    const offset = (pageNum - 1) * sizeNum
    const [rows] = await connection.query(
      `SELECT * FROM sys_platform ${whereSql} ORDER BY platform_id ASC LIMIT ? OFFSET ?`,
      [...params, sizeNum, offset],
    )
    return {
      ok: true,
      list: rows.map(mapPlatformRow),
      total,
      page: pageNum,
      pageSize: sizeNum,
    }
  })
}

// ── 创建接口 ──

export async function createPlatform(input = {}) {
  const platformName = normalizePlatformName(input.platformName)
  const platformCode = normalizePlatformCode(input.platformCode ?? input.code)
  const platformLogo = input.platformLogo == null ? '' : String(input.platformLogo).trim()
  const platformStatus = normalizePlatformStatus(input.platformStatus ?? input.status)
  const createdBy = normalizeRequiredText(input.createdBy ?? input.creator, '创建人')

  return withConnection(async (connection) => {
    await ensurePlatformSchema(connection)
    const platformId = await generatePlatformId(connection)
    await connection.query(
      `INSERT INTO sys_platform (
        platform_id, platform_name, platform_code, platform_logo, platform_status,
        created_by, updated_by, is_deleted
      ) VALUES (?,?,?,?,?,?,?,?)`,
      [platformId, platformName, platformCode, platformLogo, platformStatus, createdBy, createdBy, 0],
    )
    const platform = await selectPlatformById(connection, platformId)
    return { ok: true, platform }
  })
}

// ── 编辑接口 ──

export async function updatePlatform(input = {}) {
  const platformId = String(input.platformId ?? input.id ?? '').trim()
  if (!platformId) throw new ApiError('平台ID不可为空')
  const updatedBy = normalizeRequiredText(input.updatedBy ?? input.updater, '更新人')

  const sets = []
  const params = []

  if (input.platformName !== undefined && input.platformName !== null) {
    sets.push('platform_name = ?')
    params.push(normalizePlatformName(input.platformName))
  }
  if (input.platformCode !== undefined || input.code !== undefined) {
    sets.push('platform_code = ?')
    params.push(normalizePlatformCode(input.platformCode ?? input.code))
  }
  if (input.platformLogo !== undefined && input.platformLogo !== null) {
    sets.push('platform_logo = ?')
    params.push(String(input.platformLogo).trim())
  }
  if (input.platformStatus !== undefined || input.status !== undefined) {
    sets.push('platform_status = ?')
    params.push(normalizePlatformStatus(input.platformStatus ?? input.status))
  }
  if (input.isDeleted !== undefined && input.isDeleted !== null && input.isDeleted !== '') {
    sets.push('is_deleted = ?')
    params.push(normalizeDeletedFlag(input.isDeleted))
  }

  if (!sets.length) throw new ApiError('没有需要更新的字段')
  sets.push('updated_by = ?')
  params.push(updatedBy)

  return withConnection(async (connection) => {
    await ensurePlatformSchema(connection)
    const [result] = await connection.query(
      `UPDATE sys_platform SET ${sets.join(', ')} WHERE platform_id = ?`,
      [...params, platformId],
    )
    if (result.affectedRows === 0 && !(await selectPlatformById(connection, platformId))) {
      throw new ApiError('平台不存在', 404)
    }
    const platform = await selectPlatformById(connection, platformId)
    return { ok: true, platform }
  })
}

// ── 删除接口（软删除） ──

export async function deletePlatform(input = {}) {
  const platformId = String(input.platformId ?? input.id ?? '').trim()
  if (!platformId) throw new ApiError('平台ID不可为空')
  const updatedBy = input.updatedBy == null ? '' : String(input.updatedBy).trim()

  return withConnection(async (connection) => {
    await ensurePlatformSchema(connection)
    const [result] = await connection.query(
      'UPDATE sys_platform SET is_deleted = 1, updated_by = ? WHERE platform_id = ? AND is_deleted = 0',
      [updatedBy || null, platformId],
    )
    if (result.affectedRows === 0) {
      const exists = await selectPlatformById(connection, platformId)
      if (!exists) throw new ApiError('平台不存在', 404)
    }
    const platform = await selectPlatformById(connection, platformId)
    return { ok: true, platform }
  })
}
