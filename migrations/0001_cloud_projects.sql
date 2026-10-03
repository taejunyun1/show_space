CREATE TABLE IF NOT EXISTS cloud_projects (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 name TEXT NOT NULL,
 venue TEXT NOT NULL,
 source_project_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision >= 1),
 snapshot_key TEXT NOT NULL UNIQUE,
 snapshot_sha256 TEXT NOT NULL,
 snapshot_bytes INTEGER NOT NULL CHECK(snapshot_bytes BETWEEN 22 AND 83886080),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
);
CREATE INDEX IF NOT EXISTS cloud_projects_owner_updated ON cloud_projects(owner_id, updated_at DESC, id);
