-- 개인별 즐겨찾기 표. 이미 돌고 있는 DB에 한 번만 적용한다.
CREATE TABLE IF NOT EXISTS favorites (
  member_id TEXT NOT NULL, menu_item_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (member_id, menu_item_id));
CREATE INDEX IF NOT EXISTS idx_fav_member ON favorites(member_id, sort_order);
