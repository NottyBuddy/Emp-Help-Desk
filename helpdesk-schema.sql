-- New Employee Help Desk tables. Legacy tables and historical data are intentionally untouched.
CREATE TABLE IF NOT EXISTS helpdesk_requests (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'General',
 description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open', priority TEXT NOT NULL DEFAULT 'Normal',
 requester_name TEXT NOT NULL DEFAULT '', requester_email TEXT NOT NULL DEFAULT '', assigned_to TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hd_requests_workspace_created ON helpdesk_requests(workspace_id,created_at);
CREATE INDEX IF NOT EXISTS idx_hd_requests_workspace_status ON helpdesk_requests(workspace_id,status);
CREATE TABLE IF NOT EXISTS helpdesk_articles (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
 body TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hd_articles_workspace ON helpdesk_articles(workspace_id,published,created_at);
CREATE TABLE IF NOT EXISTS helpdesk_faqs (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
 published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hd_faqs_workspace ON helpdesk_faqs(workspace_id,published,created_at);
CREATE TABLE IF NOT EXISTS helpdesk_guides (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
 body TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hd_guides_workspace ON helpdesk_guides(workspace_id,published,created_at);
CREATE TABLE IF NOT EXISTS helpdesk_team (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '',
 email TEXT NOT NULL DEFAULT '', department TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hd_team_workspace ON helpdesk_team(workspace_id,name);
CREATE TABLE IF NOT EXISTS helpdesk_notifications (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
 kind TEXT NOT NULL DEFAULT 'info', created_at TEXT NOT NULL, read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hd_notifications_workspace ON helpdesk_notifications(workspace_id,created_at);
