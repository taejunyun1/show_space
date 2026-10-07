CREATE TABLE IF NOT EXISTS cloud_library (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('artwork','material')),
 metadata TEXT NOT NULL,
 archived INTEGER NOT NULL CHECK(archived IN (0,1)),
 revision INTEGER NOT NULL CHECK(revision >= 1),
 snapshot_key TEXT NOT NULL UNIQUE,
 snapshot_sha256 TEXT NOT NULL,
 snapshot_bytes INTEGER NOT NULL CHECK(snapshot_bytes BETWEEN 2 AND 33554432),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cloud_library_owner_kind ON cloud_library(owner_id, kind, updated_at DESC, id);
