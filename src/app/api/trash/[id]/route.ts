import { isResponse, requireAdmin } from "@/lib/guard";
import { listTrash, purgePost, restorePost } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

/** 되살리기 */
export async function POST(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  await restorePost(id);
  return Response.json({ trash: await listTrash() });
}

/** 완전 삭제 — 되돌릴 수 없다. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  await purgePost(id);
  return Response.json({ trash: await listTrash() });
}
