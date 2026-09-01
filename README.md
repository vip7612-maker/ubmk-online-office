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

## 메뉴 트리

`menu_items` 한 테이블이 `parent_id` 로 자기 자신을 가리켜 중첩을 만든다. 깊이 제한은 없다.

- `url` 이 비어 있으면 **카테고리** — 눌러서 하위를 펼치는 용도
- `url` 이 있으면 **링크** — 눌러서 오른쪽에 연다
- 둘은 배타적이지 않다. 주소가 있으면서 하위도 가진 항목은 펼침 화살표와 열기 동작을 모두 가진다
- `open_in_new` 를 켜면 iframe 대신 새 탭으로 연다
- `admin_only` / `visible` 은 서버에서 걸러서 내려준다 (숨긴 항목은 응답에 아예 없다)

> 구글·네이버처럼 `X-Frame-Options` 로 삽입을 막아둔 사이트는 iframe 안이 비어 보인다.
> 그런 메뉴는 **새 창으로 열기**를 켜 둘 것.

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
```

## 구글 OAuth

Google Cloud Console 의 OAuth 클라이언트에 아래 리디렉션 URI 를 등록해야 한다.

```
http://localhost:3000/api/auth/callback/google
https://<배포도메인>/api/auth/callback/google
```
