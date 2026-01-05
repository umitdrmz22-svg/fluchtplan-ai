
CREATE TABLE IF NOT EXISTS draft_versions (
  id TEXT PRIMARY KEY,
  draft_key TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  author TEXT,
  plan_json TEXT NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_draft_versions_draft_key ON draft_versions(draft_key);
CREATE INDEX IF NOT EXISTS idx_draft_versions_created_at ON draft_versions(created_at DESC);
