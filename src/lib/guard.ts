import { auth } from "@/lib/auth";
import { envAdminEmails, findMemberByEmail } from "@/lib/members";

export type Viewer = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "admin" | "member";
};

/**
 * 로그인한 사람. 비로그인이면 null.
 *
 * 신원의 기준은 토큰에 박힌 id 가 아니라 **이메일**이다.
 * 구성원 행의 id 가 바뀌거나(시스템 통합 등) 지웠다 다시 만들어져도
 * 이미 발급된 세션이 엉뚱한 id 로 글을 쓰는 일이 없다.
 * 권한 변경도 다시 로그인하지 않고 바로 반영된다.
 */
export async function getViewer(): Promise<Viewer | null> {
  const sessionUser = (await auth())?.user;
  const email = sessionUser?.email?.toLowerCase();
  if (!sessionUser || !email) return null;

  const member = await findMemberByEmail(email);

  return {
    // 구성원 행이 아직 없으면(첫 로그인 직후 등) 토큰의 id 로 버틴다.
    id: member?.id ?? sessionUser.id ?? "",
    email,
    name: member?.name ?? sessionUser.name ?? null,
    image: member?.image ?? sessionUser.image ?? null,
    role: resolveRole(email, member?.role),
  };
}

/** ADMIN_EMAILS 는 잠금 해제용이라 DB 값보다 앞선다. */
function resolveRole(email: string, dbRole?: "admin" | "member"): "admin" | "member" {
  if (envAdminEmails().includes(email)) return "admin";
  return dbRole === "admin" ? "admin" : "member";
}

/** API 라우트용 가드. 통과하면 Viewer, 아니면 그대로 반환할 Response. */
export async function requireViewer(): Promise<Viewer | Response> {
  const viewer = await getViewer();
  if (!viewer) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return viewer;
}

export async function requireAdmin(): Promise<Viewer | Response> {
  const viewer = await getViewer();
  if (!viewer) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (viewer.role !== "admin") {
    return Response.json({ error: "관리자만 사용할 수 있습니다." }, { status: 403 });
  }
  return viewer;
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}
