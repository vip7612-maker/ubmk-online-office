import { isResponse, requireAdmin, requireViewer } from "@/lib/guard";
import { createMenuItem, getMenuTree } from "@/lib/menu";

export async function GET() {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;
  return Response.json({ tree: await getMenuTree(viewer.role === "admin") });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return Response.json({ error: "이름을 입력하세요." }, { status: 400 });
  }

  const id = await createMenuItem({
    parentId: body.parentId ?? null,
    title,
    url: body.url ?? null,
    icon: body.icon ?? null,
    openInNew: Boolean(body.openInNew),
    adminOnly: Boolean(body.adminOnly),
  });
  // 화면이 곧바로 최신 상태를 그릴 수 있도록 트리를 함께 돌려준다.
  return Response.json({ id, tree: await getMenuTree(true) }, { status: 201 });
}
