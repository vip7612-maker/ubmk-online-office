-- 읽음 확인 표. 이미 돌고 있는 DB에 한 번만 적용한다.
CREATE TABLE IF NOT EXISTS post_reads (
  post_id TEXT NOT NULL, member_id TEXT NOT NULL, member_name TEXT,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, member_id));
CREATE INDEX IF NOT EXISTS idx_reads_post ON post_reads(post_id);
