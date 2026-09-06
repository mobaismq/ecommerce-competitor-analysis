import mysql from 'mysql2/promise'
import fs from 'fs'

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
}

const conn = await mysql.createConnection({
  host: env.MYSQL_HOST, port: Number(env.MYSQL_PORT || 3306),
  user: env.MYSQL_USER, password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DATABASE, charset: 'utf8mb4',
})

const [cols] = await conn.query(
  `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'market_%'
     AND COLUMN_NAME LIKE '%url%' AND DATA_TYPE = 'text'`,
  [env.MYSQL_DATABASE],
)

for (const col of cols) {
  const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'
  const sql = `ALTER TABLE \`${col.TABLE_NAME}\` MODIFY COLUMN \`${col.COLUMN_NAME}\` LONGTEXT ${nullable}`
  console.log('altering:', sql)
  await conn.query(sql)
}
console.log(cols.length ? `done: ${cols.length} column(s) altered` : 'no TEXT url columns left')
await conn.end()
