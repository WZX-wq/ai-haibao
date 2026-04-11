import mysql from 'mysql2/promise'

let pool: any = null
let schemaReady = false

function getEnvNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getMysqlConfig() {
  return {
    host: process.env.DB_HOST || '',
    port: getEnvNumber(process.env.DB_PORT, 3306),
    user: process.env.DB_USERNAME || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    timezone: process.env.DB_TIMEZONE || '+08:00',
  }
}

export function isMysqlConfigured() {
  const config = getMysqlConfig()
  return !!(config.host && config.user && config.database)
}

export async function getMysqlPool() {
  if (!isMysqlConfigured()) {
    throw new Error('MySQL 未配置，请补充 DB_HOST / DB_USERNAME / DB_PASSWORD / DB_NAME')
  }
  if (!pool) {
    const config = getMysqlConfig()
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: config.charset,
      timezone: config.timezone,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    })
  }
  return pool
}

export async function ensureAccountSchema() {
  if (schemaReady) return
  const db = await getMysqlPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      display_name VARCHAR(120) DEFAULT NULL,
      avatar_url VARCHAR(255) DEFAULT NULL,
      email VARCHAR(190) DEFAULT NULL,
      phone VARCHAR(40) DEFAULT NULL,
      provider_name VARCHAR(80) DEFAULT NULL,
      provider_user_id VARCHAR(190) DEFAULT NULL,
      profile_json JSON DEFAULT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_login_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_provider_identity (provider_name, provider_user_id),
      KEY idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS oauth_identities (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      provider_name VARCHAR(80) NOT NULL,
      provider_user_id VARCHAR(190) NOT NULL,
      access_token TEXT DEFAULT NULL,
      refresh_token TEXT DEFAULT NULL,
      token_type VARCHAR(40) DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      scope_text VARCHAR(255) DEFAULT NULL,
      raw_user_json JSON DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_provider_identity (provider_name, provider_user_id),
      KEY idx_identity_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS account_permission_snapshots (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      is_vip TINYINT(1) NOT NULL DEFAULT 0,
      vip_level INT NOT NULL DEFAULT 0,
      vip_expire_time DATETIME DEFAULT NULL,
      daily_limit_count INT NOT NULL DEFAULT 10,
      max_file_size BIGINT NOT NULL DEFAULT 52428800,
      allow_batch TINYINT(1) NOT NULL DEFAULT 0,
      allow_no_watermark TINYINT(1) NOT NULL DEFAULT 0,
      allow_ai_tools TINYINT(1) NOT NULL DEFAULT 1,
      allow_template_manage TINYINT(1) NOT NULL DEFAULT 1,
      extra_json JSON DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_permission_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      local_token_hash CHAR(64) NOT NULL,
      session_status VARCHAR(32) NOT NULL DEFAULT 'active',
      login_ip VARCHAR(64) DEFAULT NULL,
      user_agent VARCHAR(255) DEFAULT NULL,
      expired_at DATETIME NOT NULL,
      last_seen_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_local_token_hash (local_token_hash),
      KEY idx_session_user (user_id),
      KEY idx_session_status (session_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  schemaReady = true
}
