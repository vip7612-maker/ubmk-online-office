import { db } from "@/lib/db";

/** 이 사람이 즐겨찾기해 둔 메뉴 id 목록. 탭에 놓인 순서대로. */
export async function listFavoriteIds(memberId: string): Promise<string[]> {
  const res = await db.execute({
    sql: "SELECT menu_item_id FROM favorites WHERE member_id = ? ORDER BY sort_order, created_at",
    args: [memberId],
  });
  return res.rows.map((r) => String((r as Record<string, unknown>).menu_item_id));
}

/** 한 사람이 탭에 둘 수 있는 최대 개수. 넘치면 탭 줄이 제구실을 못 한다. */
export const MAX_FAVORITES = 12;

export async function addFavorite(memberId: string, menuItemId: string): Promise<void> {
  const res = await db.execute({
    sql: "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next, count(*) AS n FROM favorites WHERE member_id = ?",
    args: [memberId],
  });
  const row = res.rows[0] as Record<string, unknown>;
  if (Number(row.n) >= MAX_FAVORITES) {
    throw new Error(`즐겨찾기는 ${MAX_FAVORITES}개까지 둘 수 있습니다.`);
  }
  await db.execute({
    sql: "INSERT OR IGNORE INTO favorites (member_id, menu_item_id, sort_order) VALUES (?, ?, ?)",
    args: [memberId, menuItemId, Number(row.next)],
  });
}

export async function removeFavorite(memberId: string, menuItemId: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM favorites WHERE member_id = ? AND menu_item_id = ?",
    args: [memberId, menuItemId],
  });
}
