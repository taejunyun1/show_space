CREATE TABLE IF NOT EXISTS cloud_history (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES cloud_projects(id),
 owner_id TEXT NOT NULL,
 label TEXT NOT NULL,
 name TEXT NOT NULL,
 venue TEXT NOT NULL,
 source_project_id TEXT NOT NULL,
 source_revision INTEGER NOT NULL CHECK(source_revision >= 1),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
 snapshot_key TEXT NOT NULL UNIQUE,
 snapshot_sha256 TEXT NOT NULL,
 snapshot_bytes INTEGER NOT NULL CHECK(snapshot_bytes BETWEEN 22 AND 83886080),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
);
CREATE INDEX IF NOT EXISTS cloud_history_project ON cloud_history(owner_id, project_id, created_at DESC, id);
