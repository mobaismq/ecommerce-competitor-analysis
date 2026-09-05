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

const DEPT_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sys_dept (
    dept_id VARCHAR(10) NOT NULL COMMENT '部门ID（10位字母+数字，自动生成）',
    dept_name VARCHAR(15) NOT NULL COMMENT '部门名称',
    dept_level INT NOT NULL DEFAULT 1 COMMENT '部门层级（一级为1，上级层级+1自动生成）',
    parent_id VARCHAR(10) NOT NULL DEFAULT '0' COMMENT '上级部门ID（一级部门为0）',
    dept_status TINYINT NOT NULL DEFAULT 1 COMMENT '部门状态：1启用 0停用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    created_by VARCHAR(64) NOT NULL COMMENT '创建人',
    updated_by VARCHAR(64) NULL COMMENT '更新人',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '删除状态：0未删除 1已删除',
    PRIMARY KEY (dept_id),
    KEY idx_sys_dept_name (dept_name),
    KEY idx_sys_dept_parent (parent_id),
    KEY idx_sys_dept_status (dept_status),
    KEY idx_sys_dept_deleted (is_deleted),
    KEY idx_sys_dept_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表'`,
]

async function ensureDeptSchema(connection) {
  for (const statement of DEPT_SCHEMA_STATEMENTS) {
    await connection.query(statement)
  }
}

// ── 工具函数 ──

const DEPT_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

// 生成 10 位字母+数字 的部门ID
function generateDeptId() {
  let id = ''
  for (let i = 0; i < 10; i += 1) {
    id += DEPT_ID_ALPHABET[crypto.randomInt(DEPT_ID_ALPHABET.length)]
  }
  return id
}

async function generateUniqueDeptId(connection) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const deptId = generateDeptId()
    const [rows] = await connection.query('SELECT 1 AS hit FROM sys_dept WHERE dept_id = ? LIMIT 1', [deptId])
    if (rows.length === 0) return deptId
  }
  throw new ApiError('部门ID生成失败，请重试', 500)
}

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

// 部门名称：非空 + 最多15字符
function normalizeDeptName(value) {
  const text = value == null ? '' : String(value)
  const trimmed = text.trim()
  if (!trimmed) throw new ApiError('部门名称不可为空')
  if (trimmed.length > 15) throw new ApiError('部门名称最多15个字符')
  return trimmed
}

// 部门状态：1启用 0停用，默认启用(1)
function normalizeDeptStatus(value) {
  if (value == null || String(value).trim() === '') return 1
  const text = String(value).trim()
  if (text === '1' || text === '启用' || text === 'enabled' || text === 'active') return 1
  if (text === '0' || text === '停用' || text === 'disabled' || text === 'inactive') return 0
  throw new ApiError('部门状态仅支持1（启用）或0（停用）')
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

function mapDeptRow(row) {
  if (!row) return null
  return {
    deptId: String(row.dept_id || ''),
    deptName: String(row.dept_name || ''),
    deptLevel: row.dept_level == null ? 1 : Number(row.dept_level),
    parentId: row.parent_id == null ? '0' : String(row.parent_id),
    deptStatus: row.dept_status == null ? 1 : Number(row.dept_status),
    createdAt: row.created_at == null ? '' : String(row.created_at),
    updatedAt: row.updated_at == null ? '' : String(row.updated_at),
    createdBy: row.created_by == null ? '' : String(row.created_by),
    updatedBy: row.updated_by == null ? '' : String(row.updated_by),
    isDeleted: row.is_deleted == null ? 0 : Number(row.is_deleted),
  }
}

async function selectDeptById(connection, deptId) {
  const [rows] = await connection.query('SELECT * FROM sys_dept WHERE dept_id = ? LIMIT 1', [deptId])
  return rows.length ? mapDeptRow(rows[0]) : null
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

export async function listDepts({
  page = 1,
  pageSize = 10,
  deptName = '',
  deptId = '',
  status = '',
  isDeleted = 0,
  startTime = '',
  endTime = '',
} = {}) {
  const pageNum = Math.max(1, toInt(page, 1))
  const sizeNum = Math.max(1, Math.min(100, toInt(pageSize, 10)))

  const where = []
  const params = []

  if (String(deptName || '').trim()) {
    // 左侧模糊：通配符在左侧，匹配以关键字结尾的部门名（LIKE '%关键字'）
    where.push('dept_name LIKE ?')
    params.push(`%${String(deptName).trim()}`)
  }
  if (String(deptId || '').trim()) {
    where.push('dept_id = ?')
    params.push(String(deptId).trim())
  }
  if (String(status || '').trim()) {
    where.push('dept_status = ?')
    params.push(normalizeDeptStatus(status))
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
    await ensureDeptSchema(connection)
    const [countRows] = await connection.query(`SELECT COUNT(*) AS total FROM sys_dept ${whereSql}`, params)
    const total = Number(countRows[0]?.total || 0)
    const offset = (pageNum - 1) * sizeNum
    const [rows] = await connection.query(
      `SELECT * FROM sys_dept ${whereSql} ORDER BY dept_level ASC, created_at DESC, dept_id DESC LIMIT ? OFFSET ?`,
      [...params, sizeNum, offset],
    )
    return {
      ok: true,
      list: rows.map(mapDeptRow),
      total,
      page: pageNum,
      pageSize: sizeNum,
    }
  })
}

// ── 创建接口 ──

export async function createDept(input = {}) {
  const deptName = normalizeDeptName(input.deptName)
  const deptStatus = normalizeDeptStatus(input.deptStatus ?? input.status)
  const createdBy = normalizeRequiredText(input.createdBy ?? input.creator, '创建人')
  const parentId = normalizeRequiredText(input.parentId ?? input.parentDeptId, '上级部门ID')

  return withConnection(async (connection) => {
    await ensureDeptSchema(connection)

    // 部门层级：一级部门（上级为0）层级=1，其余=上级层级+1
    let deptLevel = 1
    if (parentId !== '0') {
      const parent = await selectDeptById(connection, parentId)
      if (!parent) throw new ApiError('上级部门不存在', 400)
      deptLevel = parent.deptLevel + 1
    }

    const deptId = await generateUniqueDeptId(connection)
    await connection.query(
      `INSERT INTO sys_dept (
        dept_id, dept_name, dept_level, parent_id, dept_status,
        created_by, updated_by, is_deleted
      ) VALUES (?,?,?,?,?,?,?,?)`,
      [
        deptId,
        deptName,
        deptLevel,
        parentId,
        deptStatus,
        createdBy,
        createdBy,
        0,
      ],
    )
    const dept = await selectDeptById(connection, deptId)
    return { ok: true, dept }
  })
}

// ── 编辑接口 ──

export async function updateDept(input = {}) {
  const deptId = String(input.deptId ?? input.id ?? '').trim()
  if (!deptId) throw new ApiError('部门ID不可为空')
  const updatedBy = normalizeRequiredText(input.updatedBy ?? input.updater, '更新人')

  const sets = []
  const params = []

  if (input.deptName !== undefined && input.deptName !== null) {
    sets.push('dept_name = ?')
    params.push(normalizeDeptName(input.deptName))
  }
  if (input.isDeleted !== undefined && input.isDeleted !== null && input.isDeleted !== '') {
    sets.push('is_deleted = ?')
    params.push(normalizeDeletedFlag(input.isDeleted))
  }

  if (!sets.length) throw new ApiError('没有需要更新的字段')
  sets.push('updated_by = ?')
  params.push(updatedBy)

  return withConnection(async (connection) => {
    await ensureDeptSchema(connection)
    const [result] = await connection.query(
      `UPDATE sys_dept SET ${sets.join(', ')} WHERE dept_id = ?`,
      [...params, deptId],
    )
    if (result.affectedRows === 0 && !(await selectDeptById(connection, deptId))) {
      throw new ApiError('部门不存在', 404)
    }
    const dept = await selectDeptById(connection, deptId)
    return { ok: true, dept }
  })
}

// ── 删除接口（软删除：置 is_deleted=1） ──

export async function deleteDept(input = {}) {
  const deptId = String(input.deptId ?? input.id ?? '').trim()
  if (!deptId) throw new ApiError('部门ID不可为空')
  const updatedBy = input.updatedBy == null ? '' : String(input.updatedBy).trim()

  return withConnection(async (connection) => {
    await ensureDeptSchema(connection)
    const [result] = await connection.query(
      'UPDATE sys_dept SET is_deleted = 1, updated_by = ? WHERE dept_id = ? AND is_deleted = 0',
      [updatedBy || null, deptId],
    )
    if (result.affectedRows === 0) {
      const exists = await selectDeptById(connection, deptId)
      if (!exists) throw new ApiError('部门不存在', 404)
    }
    const dept = await selectDeptById(connection, deptId)
    return { ok: true, dept }
  })
}
