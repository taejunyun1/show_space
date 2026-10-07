CREATE TABLE IF NOT EXISTS project_members (
 project_id TEXT NOT NULL,
 user_id TEXT NOT NULL,
 recipient_email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('editor','viewer','commenter')),
 revision INTEGER NOT NULL CHECK(revision >= 1),
 revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
 grant_invite_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(project_id,user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user ON project_members(user_id, revoked, project_id);
CREATE TABLE IF NOT EXISTS project_invites (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL,
 recipient_email TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('editor','viewer','commenter')),
 token_hash TEXT NOT NULL UNIQUE,
 revision INTEGER NOT NULL CHECK(revision >= 1),
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','revoked')),
 accepted_by TEXT,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS project_invites_parent ON project_invites(project_id, status, expires_at);
