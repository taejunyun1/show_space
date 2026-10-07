-- Collaboration opinions belong to an immutable publication, never Project Note.
CREATE TABLE IF NOT EXISTS review_threads (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 share_id TEXT NOT NULL,
 author_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision >= 1),
 record_json TEXT NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS review_threads_share_seq ON review_threads(share_id, seq DESC);
CREATE INDEX IF NOT EXISTS review_threads_author ON review_threads(share_id, author_id);
