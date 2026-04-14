/**
 * 读取 service/.env，对当前库执行 user-designs.mysql.sql（需已存在 app_users）
 * 用法: node scripts/ensure-user-designs-table.js
 */
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

function loadEnv(envPath) {
  const env = {}
  if (!fs.existsSync(envPath)) {
    throw new Error('missing .env at ' + envPath)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx <= 0) return
    const key = trimmed.slice(0, idx).trim()
    let val = trimmed.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
    env[key] = val
  })
  return env
}

async function main() {
  const root = path.resolve(__dirname, '..')
  const envFile = path.join(root, '.env')
  const env = loadEnv(envFile)
  const host = env.DB_HOST || process.env.DB_HOST
  const port = Number(env.DB_PORT || process.env.DB_PORT || 3306)
  const user = env.DB_USERNAME || process.env.DB_USERNAME
  const password = env.DB_PASSWORD != null ? env.DB_PASSWORD : process.env.DB_PASSWORD
  const database = env.DB_NAME || process.env.DB_NAME
  const charset = env.DB_CHARSET || process.env.DB_CHARSET || 'utf8mb4'

  if (!host || !user || !database) {
    throw new Error('DB_HOST / DB_USERNAME / DB_NAME required in .env')
  }

  const sqlPath = path.join(__dirname, 'user-designs.mysql.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset,
    multipleStatements: true,
  })

  try {
    await conn.query(sql)
    const [[colRow]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_designs' AND COLUMN_NAME = 'component_list_key'`,
    )
    if (Number(colRow.cnt) === 0) {
      await conn.query(`
        ALTER TABLE user_designs
        ADD COLUMN component_list_key VARCHAR(64) NULL DEFAULT NULL COMMENT 'design/list type=1' AFTER cate
      `)
      console.log('OK: added column component_list_key')
    }
    console.log('OK: user_designs ensured (CREATE + AUTO_INCREMENT)')
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
