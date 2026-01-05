
-- Versionstabelle für Plan-Entwürfe
CREATE TABLE IF NOT EXISTS draft_versions (
  id TEXT PRIMARY KEY,                -- UUID der Draft-Version
  draft_key TEXT NOT NULL,            -- KV-Key, z.B. draft:{uuid}
  title TEXT,                         -- frei wählbarer Titel
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  author TEXT,                        -- optional (User/Abteilung)
  plan_json TEXT NOT NULL,            -- der komplette Planzustand als JSON
  note TEXT                           -- optionale Bemerkungen
);

-- Indexe
CREATE INDEX IF NOT EXISTS idx_draft_versions_draft_key ON draft_versions(draft_key);
CREATE INDEX IF NOT EXISTS idx_draft_versions_created_at ON draft_versions(created_at DESC);
