CREATE TABLE profiles (
  id VARCHAR(128) PRIMARY KEY,
  wallet_address VARCHAR(128) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(1024) NULL,
  role VARCHAR(32) NOT NULL,
  region VARCHAR(16) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE courses (
  id VARCHAR(36) PRIMARY KEY,
  creator_profile_id VARCHAR(128) NULL,
  category_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  synopsis TEXT NOT NULL,
  year INT NOT NULL,
  hero_image_url VARCHAR(1024) NOT NULL,
  card_image_url VARCHAR(1024) NOT NULL,
  publish_status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE lessons (
  id VARCHAR(36) PRIMARY KEY,
  course_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  synopsis TEXT NOT NULL,
  duration_min INT NOT NULL,
  maturity_rating VARCHAR(32) NOT NULL,
  manifest_blob_key VARCHAR(1024) NOT NULL,
  stream_asset_id VARCHAR(36) NULL,
  publish_status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_lessons_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE media_assets (
  id VARCHAR(36) PRIMARY KEY,
  title_id VARCHAR(36) NOT NULL,
  blob_key VARCHAR(1024) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(255) NOT NULL,
  asset_type VARCHAR(32) NOT NULL,
  ingest_status VARCHAR(32) NOT NULL,
  created_by_user_id VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE course_enrollments (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  profile_id VARCHAR(128) NOT NULL,
  course_id VARCHAR(36) NOT NULL,
  source VARCHAR(32) NOT NULL,
  active TINYINT(1) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_course_enrollments_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE lesson_progress (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  profile_id VARCHAR(128) NOT NULL,
  lesson_id VARCHAR(36) NOT NULL,
  course_id VARCHAR(36) NOT NULL,
  progress_percent INT NOT NULL,
  last_position_sec INT NOT NULL,
  completed_at DATETIME NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_lesson_progress_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id),
  CONSTRAINT fk_lesson_progress_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE playback_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  profile_id VARCHAR(128) NOT NULL,
  course_id VARCHAR(36) NOT NULL,
  lesson_id VARCHAR(36) NOT NULL,
  manifest_blob_key VARCHAR(1024) NOT NULL,
  entitlement_source VARCHAR(255) NOT NULL,
  playback_token TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_playback_sessions_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_playback_sessions_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE TABLE qoe_events (
  id VARCHAR(36) PRIMARY KEY,
  playback_session_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  profile_id VARCHAR(128) NOT NULL,
  course_id VARCHAR(36) NOT NULL,
  lesson_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  event_ts DATETIME NOT NULL,
  position_ms INT NOT NULL,
  bitrate_kbps INT NULL,
  rebuffer_ms INT NULL,
  peer_hit_ratio INT NULL,
  error_code VARCHAR(255) NULL,
  device_id VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_qoe_events_playback_session FOREIGN KEY (playback_session_id) REFERENCES playback_sessions(id),
  CONSTRAINT fk_qoe_events_course FOREIGN KEY (course_id) REFERENCES courses(id),
  CONSTRAINT fk_qoe_events_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE TABLE creator_payout_ledger (
  id VARCHAR(36) PRIMARY KEY,
  creator_profile_id VARCHAR(128) NULL,
  course_id VARCHAR(36) NULL,
  course_title VARCHAR(255) NULL,
  period_key VARCHAR(32) NOT NULL,
  amount_usd DECIMAL(18,2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  source_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  formula_snapshot TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_creator_payout_ledger_course FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE creator_applications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  pitch TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  reviewed_by_user_id VARCHAR(128) NULL,
  reviewed_at DATETIME NULL
);

CREATE TABLE domain_events (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id VARCHAR(64) NOT NULL,
  occurred_at DATETIME NOT NULL,
  actor_user_id VARCHAR(128) NULL,
  actor_role VARCHAR(32) NULL,
  correlation_id VARCHAR(64) NULL,
  causation_id VARCHAR(64) NULL,
  idempotency_key VARCHAR(128) NULL,
  payload_json JSON NOT NULL,
  version INT NOT NULL
);

CREATE INDEX idx_profiles_wallet_address ON profiles(wallet_address);
CREATE INDEX idx_courses_category_id ON courses(category_id);
CREATE INDEX idx_courses_publish_status ON courses(publish_status);
CREATE INDEX idx_lessons_course_id ON lessons(course_id);
CREATE INDEX idx_lessons_publish_status ON lessons(publish_status);
CREATE INDEX idx_media_assets_title_id ON media_assets(title_id);
CREATE INDEX idx_media_assets_asset_type ON media_assets(asset_type);
CREATE INDEX idx_course_enrollments_user_id ON course_enrollments(user_id);
CREATE INDEX idx_course_enrollments_course_id ON course_enrollments(course_id);
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX idx_playback_sessions_user_id ON playback_sessions(user_id);
CREATE INDEX idx_playback_sessions_lesson_id ON playback_sessions(lesson_id);
CREATE INDEX idx_qoe_events_playback_session_id ON qoe_events(playback_session_id);
CREATE INDEX idx_qoe_events_lesson_id ON qoe_events(lesson_id);
CREATE INDEX idx_qoe_events_event_type ON qoe_events(event_type);
CREATE INDEX idx_creator_payout_ledger_creator_profile_id ON creator_payout_ledger(creator_profile_id);
CREATE INDEX idx_creator_payout_ledger_course_id ON creator_payout_ledger(course_id);
CREATE INDEX idx_creator_payout_ledger_period_key ON creator_payout_ledger(period_key);
CREATE INDEX idx_creator_applications_user_id ON creator_applications(user_id);
CREATE INDEX idx_creator_applications_status ON creator_applications(status);
CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id, occurred_at);
CREATE INDEX idx_domain_events_type ON domain_events(type, occurred_at);
CREATE UNIQUE INDEX idx_domain_events_idempotency_key ON domain_events(idempotency_key);
