// MySQL 8 / MariaDB 10.6+. All mutable state must use transactional InnoDB.
// Binary collations keep bearer tokens and normalized identity comparisons exact.
const tableOptions = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';

export const MYSQL_TABLE_NAMES = [
  'participants', 'admin_sessions', 'audit_log', 'student_import_batches',
  'student_master', 'student_import_records', 'student_import_previews',
  'request_rate_limits', 'operation_locks', 'site_settings',
  'nominasi_teams', 'nominasi_team_members',
];

export const MYSQL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS participants (
    id VARCHAR(64) PRIMARY KEY,
    nim_nip VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(40) NOT NULL,
    category VARCHAR(40),
    batch VARCHAR(4) DEFAULT '-',
    prodi VARCHAR(80),
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(30),
    qr_token VARCHAR(64) NOT NULL UNIQUE,
    is_checked_in BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    id VARCHAR(64) PRIMARY KEY,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    ip VARCHAR(64),
    user_agent VARCHAR(255),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at DATETIME(3) NOT NULL,
    INDEX idx_admin_sessions_expiry (expires_at)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(40) NOT NULL,
    actor_ip VARCHAR(64),
    target_id VARCHAR(64),
    detail VARCHAR(255),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_audit_action_ip_time (action, actor_ip, created_at),
    INDEX idx_audit_action_time (action, created_at)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS student_import_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_id VARCHAR(64) NOT NULL UNIQUE,
    prodi VARCHAR(80) NOT NULL,
    total_rows INT NOT NULL,
    valid_rows INT NOT NULL,
    invalid_rows INT NOT NULL,
    duplicate_nims INT NOT NULL,
    empty_names INT NOT NULL,
    invalid_nims INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    committed_at DATETIME(3),
    previous_batch_id VARCHAR(64),
    committed_by_ip VARCHAR(64),
    active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN 1 ELSE NULL END) STORED,
    UNIQUE KEY idx_student_batches_one_active (active_slot),
    INDEX idx_student_batches_status (status)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS student_master (
    nim VARCHAR(50) PRIMARY KEY,
    official_name VARCHAR(120) NOT NULL,
    normalized_name VARCHAR(120) NOT NULL,
    prodi VARCHAR(80) NOT NULL,
    batch_year VARCHAR(4) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    import_batch_id VARCHAR(64),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_student_master_prodi (prodi),
    INDEX idx_student_master_active (is_active),
    INDEX idx_student_master_batch (import_batch_id)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS student_import_records (
    batch_id VARCHAR(64) NOT NULL,
    nim VARCHAR(50) NOT NULL,
    official_name VARCHAR(120) NOT NULL,
    normalized_name VARCHAR(120) NOT NULL,
    prodi VARCHAR(80) NOT NULL,
    batch_year VARCHAR(4) NOT NULL,
    PRIMARY KEY (batch_id, nim)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS student_import_previews (
    batch_id VARCHAR(64) PRIMARY KEY,
    session_hash VARCHAR(64) NOT NULL,
    students JSON NOT NULL,
    result JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at DATETIME(3) NOT NULL,
    consumed_at DATETIME(3),
    INDEX idx_student_previews_expiry (expires_at)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS request_rate_limits (
    bucket_key CHAR(64) PRIMARY KEY,
    hits JSON NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    INDEX idx_request_rate_limits_expiry (expires_at)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS operation_locks (
    lock_key VARCHAR(64) PRIMARY KEY
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS site_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    ordering_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ordering_tally_url VARCHAR(2048) NOT NULL DEFAULT '',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS nominasi_teams (
    id VARCHAR(64) PRIMARY KEY,
    nama_team VARCHAR(120) NOT NULL,
    qr_token VARCHAR(64) NOT NULL UNIQUE,
    is_checked_in BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_nominasi_teams_qr (qr_token),
    INDEX idx_nominasi_teams_checked (is_checked_in)
  ) ${tableOptions}`,
  `CREATE TABLE IF NOT EXISTS nominasi_team_members (
    id VARCHAR(64) PRIMARY KEY,
    team_id VARCHAR(64) NOT NULL,
    nim_nip VARCHAR(50) NOT NULL,
    nama VARCHAR(120) NOT NULL,
    is_checked_in BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_nominasi_members_team (team_id),
    INDEX idx_nominasi_members_nim (nim_nip),
    INDEX idx_nominasi_members_checked (is_checked_in),
    FOREIGN KEY (team_id) REFERENCES nominasi_teams(id) ON DELETE CASCADE
  ) ${tableOptions}`,
];
