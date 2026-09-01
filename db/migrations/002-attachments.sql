-- 첨부파일 표 추가. 이미 돌고 있는 DB에 한 번만 적용한다.
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY, post_id TEXT, board_id TEXT,
  filename TEXT NOT NULL, url TEXT NOT NULL, pathname TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0, mime TEXT,
  kind TEXT NOT NULL DEFAULT 'file',
  uploaded_by TEXT, uploader_name TEXT, deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_att_post ON attachments(post_id, deleted_at);
