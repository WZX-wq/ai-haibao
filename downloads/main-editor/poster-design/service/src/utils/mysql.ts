import mysql from 'mysql2/promise'

let pool: any = null
let schemaReady = false
let userDesignsSchemaReady = false

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

async function ensureUserDesignsComponentListKeyColumn(db: any) {
  const [[colRow]]: any = await db.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_designs' AND COLUMN_NAME = 'component_list_key'`,
  )
  if (Number(colRow?.cnt) === 0) {
    await db.query(`
      ALTER TABLE user_designs
      ADD COLUMN component_list_key VARCHAR(64) NULL DEFAULT NULL COMMENT 'design/list type=1 时的 cate，如 text/comp'
      AFTER cate
    `)
  }
}

/** 用户画布数据（与内置模板 id 区隔：AUTO_INCREMENT 从 1e9 起） */
export async function ensureUserDesignsSchema() {
  await ensureAccountSchema()
  const db = await getMysqlPool()
  if (!userDesignsSchemaReady) {
    await db.query(`
    CREATE TABLE IF NOT EXISTS user_designs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      design_type TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=poster/template 1=component',
      title VARCHAR(255) NOT NULL DEFAULT '',
      width INT UNSIGNED NOT NULL DEFAULT 0,
      height INT UNSIGNED NOT NULL DEFAULT 0,
      cate INT NOT NULL DEFAULT 0,
      component_list_key VARCHAR(64) NULL DEFAULT NULL COMMENT 'design/list type=1 时的 cate，如 text/comp',
      state TINYINT NOT NULL DEFAULT 1,
      data_json LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user_designs_user (user_id),
      KEY idx_user_designs_user_type (user_id, design_type),
      CONSTRAINT fk_user_designs_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1000000000;
  `)
    const [[countRow]]: any = await db.query('SELECT COUNT(*) AS cnt FROM user_designs')
    if (Number(countRow?.cnt) === 0) {
      await db.query('ALTER TABLE user_designs AUTO_INCREMENT = 1000000000')
    }
    userDesignsSchemaReady = true
  }
  await ensureUserDesignsComponentListKeyColumn(db)
}

let userUsageDailySchemaReady = false

/** 每日下载次数统计（与 service/usage 消费逻辑共用） */
export async function ensureUserUsageDailySchema() {
  if (userUsageDailySchemaReady) return
  await ensureAccountSchema()
  const db = await getMysqlPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_usage_daily (
      user_id BIGINT UNSIGNED NOT NULL,
      usage_date DATE NOT NULL,
      download_count INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, usage_date),
      KEY idx_usage_date (usage_date),
      CONSTRAINT fk_user_usage_daily_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  userUsageDailySchemaReady = true
}

export async function getTodayDownloadUsage(userId: number): Promise<number> {
  if (!isMysqlConfigured()) return 0
  try {
    await ensureUserUsageDailySchema()
    const db = await getMysqlPool()
    const [rows]: any = await db.query(
      'SELECT download_count FROM user_usage_daily WHERE user_id = ? AND usage_date = CURDATE() LIMIT 1',
      [userId],
    )
    return rows?.[0] ? Number(rows[0].download_count) : 0
  } catch {
    return 0
  }
}

let userActivityLogSchemaReady = false

export async function ensureUserActivityLogSchema() {
  if (userActivityLogSchemaReady) return
  await ensureAccountSchema()
  const db = await getMysqlPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_activity_log (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(32) NOT NULL,
      summary VARCHAR(512) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_activity_user_time (user_id, created_at),
      CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  userActivityLogSchemaReady = true
}

/** 写入一条用户操作记录（失败仅打日志，不影响主流程） */
export async function insertUserActivityLog(userId: number, action: string, summary: string) {
  if (!isMysqlConfigured() || !userId) return
  try {
    await ensureUserActivityLogSchema()
    const db = await getMysqlPool()
    await db.query(`INSERT INTO user_activity_log (user_id, action, summary) VALUES (?, ?, ?)`, [
      userId,
      String(action || '').slice(0, 32),
      String(summary || '').slice(0, 512),
    ])
  } catch (e) {
    console.warn('[insertUserActivityLog]', e)
  }
}

export type RecentAccountRecord = { title: string }

/**
 * 个人中心「最近记录」：下载日志 + 最近更新的作品（user_designs）
 * 下载单独拉取并参与时间排序，避免大量保存作品把下载挤出列表。
 */
export async function getMergedRecentAccountRecords(userId: number, limit = 5): Promise<RecentAccountRecord[]> {
  if (!isMysqlConfigured() || !userId) return []
  try {
    await ensureUserActivityLogSchema()
    await ensureUserDesignsSchema()
    const db = await getMysqlPool()
    const [downloadRows]: any = await db.query(
      `SELECT id, created_at FROM user_activity_log WHERE user_id = ? AND action = 'download' ORDER BY id DESC LIMIT 30`,
      [userId],
    )
    const [otherLogRows]: any = await db.query(
      `SELECT id, action, summary, created_at FROM user_activity_log WHERE user_id = ? AND action <> 'download' ORDER BY id DESC LIMIT 20`,
      [userId],
    )
    const [designRows]: any = await db.query(
      `SELECT id, title, design_type, updated_at FROM user_designs WHERE user_id = ? ORDER BY updated_at DESC LIMIT 40`,
      [userId],
    )
    type Item = { t: number; title: string; key: string }
    const items: Item[] = []
    for (const r of downloadRows || []) {
      const ts = new Date(r.created_at).getTime()
      if (Number.isNaN(ts)) continue
      items.push({
        t: ts,
        title: '下载/导出作品',
        key: `dl-${r.id}`,
      })
    }
    for (const r of otherLogRows || []) {
      const ts = new Date(r.created_at).getTime()
      if (Number.isNaN(ts)) continue
      const text = String(r.summary || r.action || '操作').trim() || '操作记录'
      items.push({ t: ts, title: text, key: `log-${r.id}` })
    }
    for (const r of designRows || []) {
      const ts = new Date(r.updated_at).getTime()
      if (Number.isNaN(ts)) continue
      const name = String(r.title || '未命名').trim() || '未命名'
      const kind = Number(r.design_type) === 1 ? '组件' : '作品'
      items.push({ t: ts, title: `保存${kind}「${name}」`, key: `ud-${r.id}-${ts}` })
    }
    items.sort((a, b) => b.t - a.t)
    const downloadOnly = items.filter((x) => x.key.startsWith('dl-'))
    let picks = items.slice(0, limit)
    if (downloadOnly.length > 0 && !picks.some((p) => p.key.startsWith('dl-'))) {
      const newest = downloadOnly[0]
      picks = [newest, ...items.filter((x) => x.key !== newest.key)].slice(0, limit)
    }
    const fmt = (t: number) =>
      new Date(t).toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    const seen = new Set<string>()
    const out: RecentAccountRecord[] = []
    for (const x of picks) {
      if (seen.has(x.key)) continue
      seen.add(x.key)
      out.push({ title: `${x.title} · ${fmt(x.t)}` })
    }
    return out
  } catch (e) {
    console.warn('[getMergedRecentAccountRecords]', e)
    return []
  }
}
