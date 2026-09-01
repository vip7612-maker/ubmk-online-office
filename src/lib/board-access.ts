import { db } from "@/lib/db";
import type { Viewer } from "@/lib/guard";
import type { WriteRole } from "@/lib/menu";

export type BoardInfo = {
  id: string;
  title: string;
  writeRole: WriteRole;
  adminOnly: boolean;
  visible: boolean;
};

/** menu_items 중 게시판인 것만 집어 온다. */
export async function getBoard(id: string): Promise<BoardInfo | null> {
  const res = await db.execute({
    sql: "SELECT id, title, write_role, admin_only, visible FROM menu_items WHERE id = ? AND is_board = 1 LIMIT 1",
    args: [id],
  });
  if (!res.rows.length) return null;
  const r = res.rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    title: String(r.title),
    writeRole: r.write_role === "member" ? "member" : "admin",
    adminOnly: Number(r.admin_only) === 1,
    visible: Number(r.visible) === 1,
  };
}

/** 이 사람이 이 게시판을 볼 수 있는가. 사이드바에서 걸러지는 규칙과 같다. */
export function canRead(board: BoardInfo, viewer: Viewer): boolean {
  if (viewer.role === "admin") return true;
  return board.visible && !board.adminOnly;
}

/** 이 사람이 이 게시판에 새 글을 쓸 수 있는가. */
export function canWrite(board: BoardInfo, viewer: Viewer): boolean {
  if (viewer.role === "admin") return true;
  return board.writeRole === "member" && canRead(board, viewer);
}
