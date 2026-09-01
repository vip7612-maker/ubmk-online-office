# 데이터베이스 운영

Turso(libSQL) 한 곳에 모든 자료가 있다. **자료가 사라지지 않는 것**이 이 문서의 목적이다.

DB 이름: `ubmk-office`

## 자료를 지키는 장치

| 장치 | 무엇을 막는가 |
| --- | --- |
| Turso **삭제 방지** | 실수로 `turso db destroy` 를 쳐도 DB가 지워지지 않는다 |
| 글의 **소프트 삭제** | 글을 지워도 행은 남는다. `deleted_at` 에 시각만 찍힌다 |
| 게시판 **삭제 차단** | 글이 남아 있는 게시판은 메뉴에서 지울 수 없다 (API가 409로 거절) |
| `posts` 에 **외래키 없음** | 메뉴를 지워도 그 안에 쌓인 글이 함께 사라지지 않는다 |
| `author_name` 저장 | 구성원을 지워도 글에 쓴 사람 이름은 남는다 |
| `scripts/backup.sh` | 통째로 파일 하나로 내려받는다 |

삭제 방지가 켜져 있는지 확인:

```bash
turso db show ubmk-office | grep -i "delete protection"
```

## 백업

```bash
./scripts/backup.sh
```

`backups/ubmk-office-YYYYMMDD-HHMM.db` 로 떨어진다 (30일 지난 것은 자동 정리).
`backups/` 는 git에 올라가지 않으니, 중요한 시점의 백업은 따로 보관할 것.

정기 백업을 걸어두려면 (매일 새벽 3시):

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * cd $PWD && ./scripts/backup.sh >> backups/cron.log 2>&1") | crontab -
```

## 되돌리기

### 실수로 지운 글 되살리기

글 삭제는 표시만 하는 것이라 되돌릴 수 있다.

```bash
# 최근에 지워진 글 보기
turso db shell ubmk-office \
  "SELECT id, title, author_name, deleted_at FROM posts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 20"

# 되살리기
turso db shell ubmk-office "UPDATE posts SET deleted_at = NULL WHERE id = '<글 id>'"
```

### 백업 파일에서 통째로 복구

기존 DB를 덮어쓰지 말고 새 DB로 올린 뒤 확인하고 갈아탄다.

```bash
turso db create ubmk-office-restore --from-file backups/ubmk-office-20260901-2059.db
turso db shell ubmk-office-restore "SELECT count(*) FROM posts"   # 내용 확인
```

확인이 끝나면 Vercel 환경변수 `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` 을
새 DB 것으로 바꾸고 재배포한다. 원본은 지우지 말고 남겨 둘 것.

## 스키마 적용

새로 만드는 DB:

```bash
turso db shell <새DB> < db/schema.sql
turso db shell <새DB> < db/seed.sql     # 기본 메뉴 (선택)
```

이미 돌고 있는 DB에 변경분만 적용할 때는 `db/migrations/` 안의 파일을 순서대로 한 번씩만
돌린다. 두 번 돌리면 `duplicate column` 오류가 난다.

## 표

- **members** — 구성원. 구글 로그인 시 자동 등록된다
- **menu_items** — 좌측 메뉴 트리. `is_board=1` 이면 앱 안의 게시판
- **posts** — 게시판 글. `deleted_at IS NULL` 인 것만 화면에 보인다
