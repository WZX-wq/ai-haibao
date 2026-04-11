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

CREATE TABLE IF NOT EXISTS poster_designs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  source_template_id VARCHAR(64) DEFAULT NULL,
  title VARCHAR(160) NOT NULL,
  cate INT NOT NULL DEFAULT 0,
  width INT NOT NULL DEFAULT 0,
  height INT NOT NULL DEFAULT 0,
  design_status VARCHAR(32) NOT NULL DEFAULT 'draft',
  cover_url VARCHAR(255) DEFAULT NULL,
  design_json JSON NOT NULL,
  design_hash CHAR(64) DEFAULT NULL,
  last_exported_at DATETIME DEFAULT NULL,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_design_user (user_id),
  KEY idx_design_status (design_status),
  KEY idx_design_deleted (deleted_at),
  KEY idx_design_template (source_template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS poster_export_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  design_id BIGINT UNSIGNED DEFAULT NULL,
  export_type VARCHAR(32) NOT NULL DEFAULT 'png',
  file_name VARCHAR(255) DEFAULT NULL,
  file_url VARCHAR(255) DEFAULT NULL,
  file_size BIGINT DEFAULT NULL,
  snapshot_hash CHAR(64) DEFAULT NULL,
  export_status VARCHAR(32) NOT NULL DEFAULT 'success',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_export_user (user_id),
  KEY idx_export_design (design_id),
  KEY idx_export_status (export_status),
  KEY idx_export_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
