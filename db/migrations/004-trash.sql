-- 휴지통: 누가 지웠는지 남긴다. 한 번만 적용한다.
ALTER TABLE posts ADD COLUMN deleted_by TEXT;
ALTER TABLE posts ADD COLUMN deleted_by_name TEXT;
