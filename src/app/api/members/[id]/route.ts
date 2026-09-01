import { isResponse, requireAdmin } from "@/lib/guard";
import { deleteMember, listMembers, updateMember } from "@/lib/members";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });

  // 자기 자신의 관리자 권한을 스스로 내려놓아 잠기는 일을 막는다.
  if (id === admin.id && (body.role === "member" || body.active === false)) {
    return Response.json(
      { error: "자기 자신의 관리자 권한이나 사용 여부는 바꿀 수 없습니다." },
      { status: 400 },
    );
  }

  await updateMember(id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.department !== undefined ? { department: body.department } : {}),
    ...(body.role !== undefined ? { role: body.role === "admin" ? "admin" : "member" } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
  });
  return Response.json({ members: await listMembers() });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const { id } = await ctx.params;
  if (id === admin.id) {
    return Response.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 });
  }
  await deleteMember(id);
  return Response.json({ members: await listMembers() });
}
