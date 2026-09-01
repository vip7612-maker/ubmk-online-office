import { isResponse, requireAdmin } from "@/lib/guard";
import { listTrash } from "@/lib/posts";

export async function GET() {
  const admin = await requireAdmin();
  if (isResponse(admin)) return admin;
  return Response.json({ trash: await listTrash() });
}
