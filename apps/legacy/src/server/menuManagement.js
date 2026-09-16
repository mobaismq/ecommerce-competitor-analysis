import mysql from 'mysql2/promise'

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

const MENU_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sys_menu (
    menu_id INT NOT NULL COMMENT '菜单ID',
    menu_name VARCHAR(50) NOT NULL COMMENT '菜单名称',
    level1_name VARCHAR(50) NOT NULL COMMENT '一级菜单名',
    level2_name VARCHAR(50) NOT NULL COMMENT '二级菜单名',
    level3_name VARCHAR(50) NULL COMMENT '三级菜单名（可为空）',
    sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (menu_id),
    KEY idx_sys_menu_level1 (level1_name),
    KEY idx_sys_menu_level2 (level2_name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='菜单权限字典表'`,
  `CREATE TABLE IF NOT EXISTS sys_button (
    button_id INT NOT NULL COMMENT '按钮ID',
    button_name VARCHAR(50) NOT NULL COMMENT '按钮名称',
    menu_id INT NOT NULL COMMENT '所属菜单ID',
    sort_no INT NOT NULL DEFAULT 0 COMMENT '排序号',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (button_id),
    KEY idx_sys_button_menu (menu_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='按钮权限字典表'`,
]

// 菜单种子数据：menu_id 沿用现有编号 1001~1013
const MENU_SEED = [
  [1001, 'AI数据采集', '市场', '竞品分析', 'AI数据采集', 1],
  [1002, '分析报告', '市场', '竞品分析', '分析报告', 2],
  [1003, '商品主图', 'AIGC', '商品主图', '', 3],
  [1004, '详情图', 'AIGC', '详情图', '', 4],
  [1005, '爆款图复刻', 'AIGC', '爆款图复刻', '', 5],
  [1006, '爆款视频复刻', 'AIGC', '爆款视频复刻', '', 6],
  [1007, '图库', '资产库', '图库', '', 7],
  [1008, '视频库', '资产库', '视频库', '', 8],
  [1009, '商品主档', '商品', '商品主档', '', 9],
  [1010, '平台商品', '商品', '平台商品', '', 10],
  [1011, '账号管理', '设置', '账号管理', '', 11],
  [1012, '角色管理', '设置', '角色管理', '', 12],
  [1013, '店铺管理', '设置', '店铺管理', '', 13],
]

// 按钮种子数据：button_id 沿用现有编号，menu_id 关联所属菜单
const BUTTON_SEED = [
  [2001, '新增商品', 1009, 1],
  [2002, '导入商品', 1009, 2],
  [2003, '编辑', 1009, 3],
  [2004, '停用/启用', 1009, 4],
  [2005, '删除', 1009, 5],
  [2006, '发布商品', 1010, 1],
  [2007, '编辑', 1010, 2],
  [2008, '发布', 1010, 3],
  [2009, '上架/下架', 1010, 4],
  [2010, '新增账号', 1011, 1],
  [2011, '编辑', 1011, 2],
  [2012, '停用/启用', 1011, 3],
  [2013, '删除', 1011, 4],
  [2014, '创建角色', 1012, 1],
  [2015, '编辑', 1012, 2],
  [2016, '停用/启用', 1012, 3],
  [2017, '删除', 1012, 4],
  [2018, '新增店铺', 1013, 1],
  [2019, '授权', 1013, 2],
  [2020, '删除', 1013, 3],
  [2021, '新建部门', 1011, 5],
  [2022, '创建子部门', 1011, 6],
  [2023, '重命名', 1011, 7],
  [2024, '删除部门', 1011, 8],
]

async function ensureMenuSchema(connection) {
  for (const statement of MENU_SCHEMA_STATEMENTS) {
    await connection.query(statement)
  }
  for (const menu of MENU_SEED) {
    await connection.query(
      'INSERT IGNORE INTO sys_menu (menu_id, menu_name, level1_name, level2_name, level3_name, sort_no) VALUES (?,?,?,?,?,?)',
      menu,
    )
  }
  for (const button of BUTTON_SEED) {
    await connection.query(
      'INSERT IGNORE INTO sys_button (button_id, button_name, menu_id, sort_no) VALUES (?,?,?,?)',
      button,
    )
  }
}

// ── 菜单/按钮权限字典查询接口 ──

export async function listMenus() {
  return withConnection(async (connection) => {
    await ensureMenuSchema(connection)
    const [menus] = await connection.query('SELECT * FROM sys_menu ORDER BY sort_no ASC, menu_id ASC')
    const [buttons] = await connection.query('SELECT * FROM sys_button ORDER BY sort_no ASC, button_id ASC')

    const buttonMap = new Map()
    for (const button of buttons) {
      if (!buttonMap.has(button.menu_id)) buttonMap.set(button.menu_id, [])
      buttonMap.get(button.menu_id).push({ buttonId: button.button_id, buttonName: button.button_name })
    }

    const list = menus.map((menu) => ({
      menuId: Number(menu.menu_id),
      menuName: String(menu.menu_name || ''),
      level1Name: String(menu.level1_name || ''),
      level2Name: String(menu.level2_name || ''),
      level3Name: menu.level3_name == null ? '' : String(menu.level3_name),
      buttons: buttonMap.get(menu.menu_id) || [],
    }))

    return { ok: true, menus: list }
  })
}
