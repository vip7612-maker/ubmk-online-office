import { auth } from "@/lib/auth";

export type Viewer = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "admin" | "member";
};

/** 로그인한 사람. 비로그인이면 null. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role ?? "member",
  };
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
