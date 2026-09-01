import { isResponse, requireViewer } from "@/lib/guard";
import { addFavorite, listFavoriteIds, removeFavorite } from "@/lib/favorites";
import { db } from "@/lib/db";

export async function GET() {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;
  return Response.json({ favoriteIds: await listFavoriteIds(viewer.id) });
}

/** { menuItemId, on } — 켜면 탭에 올리고, 끄면 내린다. */
export async function POST(req: Request) {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;

  const body = await req.json().catch(() => null);
  const menuItemId = typeof body?.menuItemId === "string" ? body.menuItemId : "";
  if (!menuItemId) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });

  if (body.on) {
    // 열 수 있는 메뉴만 탭에 올린다. 카테고리는 탭이 될 수 없다.
    const found = await db.execute({
      sql: "SELECT 1 FROM menu_items WHERE id = ? AND (url IS NOT NULL OR is_board = 1) LIMIT 1",
      args: [menuItemId],
    });
    if (!found.rows.length) {
      return Response.json({ error: "탭에 올릴 수 없는 메뉴입니다." }, { status: 400 });
    }
    try {
      await addFavorite(viewer.id, menuItemId);
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 409 });
    }
  } else {
    await removeFavorite(viewer.id, menuItemId);
  }

  return Response.json({ favoriteIds: await listFavoriteIds(viewer.id) });
}
