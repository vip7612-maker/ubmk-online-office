import { isResponse, requireAdmin } from "@/lib/guard";
import { deleteMenuItem, getMenuTree, moveMenuItem, updateMenuItem } from "@/lib/menu";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });

  // 순서 이동은 별도 동작으로 처리한다.
  if (body.move === "up" || body.move === "down") {
    await moveMenuItem(id, body.move);
    return Response.json({ tree: await getMenuTree(true) });
  }

  if (typeof body.title === "string" && !body.title.trim()) {
    return Response.json({ error: "이름은 비울 수 없습니다." }, { status: 400 });
  }

  await updateMenuItem(id, {
    ...(body.title !== undefined ? { title: String(body.title) } : {}),
    ...(body.url !== undefined ? { url: body.url } : {}),
    ...(body.icon !== undefined ? { icon: body.icon } : {}),
    ...(body.openInNew !== undefined ? { openInNew: Boolean(body.openInNew) } : {}),
    ...(body.adminOnly !== undefined ? { adminOnly: Boolean(body.adminOnly) } : {}),
    ...(body.visible !== undefined ? { visible: Boolean(body.visible) } : {}),
    ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
  });
  return Response.json({ tree: await getMenuTree(true) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  await deleteMenuItem(id);
  return Response.json({ tree: await getMenuTree(true) });
}
