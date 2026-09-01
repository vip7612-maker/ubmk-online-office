import { isResponse, requireAdmin } from "@/lib/guard";
import { createMember, findMemberByEmail, listMembers } from "@/lib/members";

export async function GET() {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;
  return Response.json({ members: await listMembers() });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "올바른 이메일을 입력하세요." }, { status: 400 });
  }
  if (await findMemberByEmail(email)) {
    return Response.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
  }

  await createMember({
    email,
    name: body.name ?? null,
    department: body.department ?? null,
    role: body.role === "admin" ? "admin" : "member",
  });
  return Response.json({ members: await listMembers() }, { status: 201 });
}
