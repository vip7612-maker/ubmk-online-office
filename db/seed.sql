-- 처음 화면이 비어 보이지 않도록 넣는 기본 메뉴. 관리자 페이지에서 자유롭게 고치면 된다.
INSERT OR IGNORE INTO menu_items (id, parent_id, title, url, open_in_new, admin_only, visible, sort_order) VALUES
  ('seed-notice',  NULL, '공지사항', NULL, 0, 0, 1, 0),
  ('seed-board',   NULL, '게시판',   NULL, 0, 0, 1, 1),
  ('seed-schedule',NULL, '시간표',   NULL, 0, 0, 1, 2);

INSERT OR IGNORE INTO menu_items (id, parent_id, title, url, open_in_new, admin_only, visible, sort_order) VALUES
  ('seed-notice-school', 'seed-notice',  '학교 공지',   'https://www.ubmk.net', 1, 0, 1, 0),
  ('seed-board-free',    'seed-board',   '자유게시판',  NULL, 0, 0, 1, 0),
  ('seed-schedule-cal',  'seed-schedule','학사일정',    NULL, 0, 0, 1, 0);
