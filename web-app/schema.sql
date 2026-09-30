CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL CHECK(length(raw_text) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_user_created ON events(user_id, created_at DESC, id ASC);
