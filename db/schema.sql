-- UBMK 온라인교무실 스키마
-- 적용:  turso db shell ubmk-office < db/schema.sql

-- 구성원. 구글 로그인 시 자동 생성되고, 관리자 페이지에서 사전 등록도 가능하다.
CREATE TABLE IF NOT EXISTS members (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,      -- 항상 소문자로 저장
  name          TEXT,
  image         TEXT,
  department    TEXT,
  role          TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  active        INTEGER NOT NULL DEFAULT 1,      -- 0이면 로그인 차단
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 좌측 메뉴 트리. url이 NULL이면 카테고리(펼침 전용), 값이 있으면 링크.
-- parent_id로 무한 중첩이 가능하다.
CREATE TABLE IF NOT EXISTS menu_items (
  id           TEXT PRIMARY KEY,
  parent_id    TEXT REFERENCES menu_items(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  url          TEXT,
  icon         TEXT,
  open_in_new  INTEGER NOT NULL DEFAULT 0,  -- 1이면 iframe 대신 새 탭으로 연다
  admin_only   INTEGER NOT NULL DEFAULT 0,
  visible      INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- is_board = 1 이면 외부 주소 대신 앱 안의 게시판을 우측에 띄운다.
  is_board     INTEGER NOT NULL DEFAULT 0,
  -- 그 게시판에 글을 쓸 수 있는 최소 권한: 'admin' | 'member'
  write_role   TEXT NOT NULL DEFAULT 'admin',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_parent ON menu_items(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

-- ── 게시판 글 ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  -- 어느 게시판(menu_items.id)에 속한 글인지. 일부러 외래키를 걸지 않았다 —
  -- 메뉴를 지웠다고 해서 그 안에 쌓인 글이 함께 사라지면 안 된다.
  board_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  author_id   TEXT,
  author_name TEXT,          -- 작성 당시 이름. 나중에 구성원이 지워져도 남는다.
  pinned      INTEGER NOT NULL DEFAULT 0,
  views       INTEGER NOT NULL DEFAULT 0,
  -- 삭제는 표시만 한다(휴지통). 30일이 지나면 청소 작업이 완전히 지운다.
  deleted_at      TEXT,
  deleted_by      TEXT,
  deleted_by_name TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board_id, pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_live  ON posts(board_id, deleted_at);

-- ── 첨부파일 ────────────────────────────────────────────────────
-- 실제 파일은 Vercel Blob 에 있고 여기에는 가리키는 정보만 둔다.
-- posts 와 마찬가지로 외래키를 걸지 않는다 — 글을 지워도 파일 기록은 남는다.
CREATE TABLE IF NOT EXISTS attachments (
  id            TEXT PRIMARY KEY,
  post_id       TEXT,          -- 글을 저장하기 전 올린 파일은 NULL
  board_id      TEXT,
  filename      TEXT NOT NULL, -- 사용자가 올린 원래 이름
  url           TEXT NOT NULL,
  pathname      TEXT NOT NULL, -- Blob 안의 경로 (지울 때 쓴다)
  size          INTEGER NOT NULL DEFAULT 0,
  mime          TEXT,
  kind          TEXT NOT NULL DEFAULT 'file',  -- 'file' | 'image'(본문에 삽입)
  uploaded_by   TEXT,
  uploader_name TEXT,
  deleted_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_att_post ON attachments(post_id, deleted_at);

-- ── 즐겨찾기 ────────────────────────────────────────────────────
-- 사람마다 매일 여는 메뉴가 다르므로 개인별로 둔다.
-- 우측 상단 탭으로 올라간다. 여기도 외래키를 걸지 않는다.
CREATE TABLE IF NOT EXISTS favorites (
  member_id    TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (member_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_fav_member ON favorites(member_id, sort_order);
