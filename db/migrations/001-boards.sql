-- 이미 만들어진 DB를 게시판 기능에 맞추는 이관 스크립트.
-- 새로 만드는 DB는 db/schema.sql 만으로 충분하다 (컬럼이 이미 들어 있다).
-- 한 번만 돌 수 있다 — 두 번째부터는 duplicate column 오류가 난다.
ALTER TABLE menu_items ADD COLUMN is_board INTEGER NOT NULL DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN write_role TEXT NOT NULL DEFAULT 'admin';
