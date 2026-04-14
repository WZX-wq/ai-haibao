-- 用户设计稿（按 user_id 隔离）。需在 app_users 已存在后执行。
-- 与 account-center.mysql.sql 可分开部署。

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE user_designs AUTO_INCREMENT = 1000000000;

-- 已有表（早期未含该列）可手工执行：
-- ALTER TABLE user_designs ADD COLUMN component_list_key VARCHAR(64) NULL DEFAULT NULL COMMENT 'design/list type=1' AFTER cate;
