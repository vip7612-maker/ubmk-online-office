# UBMK 온라인교무실

학교 구글 계정(@ubmk.net)으로만 들어올 수 있는 교직원 포털. 왼쪽 메뉴 트리에서 항목을
고르면 오른쪽 화면에 해당 페이지가 열린다. 메뉴 구성과 구성원 권한은 관리자가 화면에서
직접 고친다.

- **Next.js 16** (App Router, Turbopack) + **Tailwind CSS v4**
- **Auth.js v5** — Google 로그인, JWT 세션
- **Turso** (libSQL) — 메뉴 트리와 구성원 명단

## 화면

| 경로     | 설명                                                            |
| -------- | --------------------------------------------------------------- |
| `/`      | 좌측 메뉴 + 우측 뷰어. `?m=<메뉴id>` 로 열린 메뉴가 주소에 남는다 |
| `/login` | 구글 로그인                                                      |
| `/admin` | 관리자 전용 — 메뉴 관리 / 구성원 관리                            |

## 접근 규칙

로그인은 다음 순서로 판정한다 (`src/lib/auth.ts`).

1. `ADMIN_EMAILS` 에 있는 이메일 → 무조건 통과, 로그인할 때마다 `admin` 으로 승격
2. `members.active = 0` 인 계정 → 차단
3. 구글 `hd` 가 `ALLOWED_GOOGLE_DOMAIN` 이거나 이메일이 `@<도메인>` 으로 끝남 → 통과
4. 그 외 → 차단

@ubmk.net 계정은 첫 로그인 때 `members` 에 자동 등록된다. 관리자 페이지에서 미리 추가해
두고 부서·권한을 지정할 수도 있다.

모든 `/api/*` 는 서버에서 세션을 다시 확인한다. 조회는 로그인만, 변경은 `admin` 만 된다.

## 게시판

메뉴 항목의 `is_board` 를 켜면 외부 주소 대신 **앱 안의 게시판**이 우측에 열린다
(관리자 페이지 → 메뉴 수정 → '앱 안의 게시판으로 쓰기').

- 목록 · 글 보기 · 쓰기 · 수정이 우측 패널 안에서 이뤄진다
- 본문은 마크다운. 원시 HTML은 일부러 허용하지 않는다
- `write_role` 로 글쓰기 권한을 정한다 — `admin`(관리자만) 또는 `member`(모든 구성원).
  읽기는 그 메뉴가 보이는 사람 모두
- 맨 위 고정(공지)은 관리자만 걸 수 있다
- 글 수정·삭제는 글쓴이 본인과 관리자만

**자료 보존** — 글 삭제는 표시만 하고 행은 남긴다. 글이 있는 게시판은 메뉴에서 지워지지
않는다. 자세한 것은 [db/README.md](db/README.md).

## 메뉴 트리

`menu_items` 한 테이블이 `parent_id` 로 자기 자신을 가리켜 중첩을 만든다. 깊이 제한은 없다.

- `url` 도 없고 `is_board` 도 아니면 **카테고리** — 눌러서 하위를 펼치고 접는 역할만 한다.
  우측 화면은 건드리지 않는다
- `url` 이 있으면 **링크**, `is_board=1` 이면 **게시판** — 어느 쪽이든 누르면 우측에 열린다
- 카테고리도 하위를 가질 수 있고, 링크·게시판도 하위를 가질 수 있다. 하위가 있으면
  펼침 화살표가 붙고, 열리는 항목이면 이름을 눌러 연다
- `admin_only` / `visible` 은 서버에서 걸러서 내려준다 (숨긴 항목은 응답에 아예 없다)

> 구글·네이버처럼 `X-Frame-Options` 로 삽입을 막아둔 사이트는 화면이 비어 보인다.
> 그런 메뉴는 `open_in_new`(관리자 화면의 **삽입 차단 안내 표시**)를 켜 두면
> 새 창으로 여는 안내가 프레임 위에 함께 뜬다.

## 개발

```bash
npm install
npm run dev
```

`.env.local` 에 필요한 값:

```bash
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

AUTH_SECRET=            # openssl rand -base64 32
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

ALLOWED_GOOGLE_DOMAIN=ubmk.net
ADMIN_EMAILS=vip7612@gmail.com
```

`ALLOWED_GOOGLE_DOMAIN` 을 비우면 도메인 검사를 건너뛴다 (로컬 개발용).

## 데이터베이스

```bash
turso db shell ubmk-office < db/schema.sql   # 테이블
turso db shell ubmk-office < db/seed.sql     # 기본 메뉴 (선택)
./scripts/backup.sh                          # 백업
```

백업·복구·소프트 삭제 되돌리기는 [db/README.md](db/README.md) 에 정리해 두었다.

## 구글 OAuth

Google Cloud Console 의 OAuth 클라이언트에 아래 리디렉션 URI 를 등록해야 한다.

```
http://localhost:3000/api/auth/callback/google
https://<배포도메인>/api/auth/callback/google
```
