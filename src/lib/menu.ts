import { db, newId } from "@/lib/db";

export type WriteRole = "admin" | "member";

export type MenuItem = {
  id: string;
  parentId: string | null;
  title: string;
  url: string | null;
  icon: string | null;
  openInNew: boolean;
  adminOnly: boolean;
  visible: boolean;
  sortOrder: number;
  /** 참이면 외부 주소 대신 앱 안의 게시판을 우측에 띄운다. */
  isBoard: boolean;
  /** 그 게시판에 글을 쓸 수 있는 최소 권한. */
  writeRole: WriteRole;
};

export type MenuNode = MenuItem & { children: MenuNode[] };

type Row = Record<string, unknown>;

function toItem(r: Row): MenuItem {
  return {
    id: String(r.id),
    parentId: (r.parent_id as string) ?? null,
    title: String(r.title),
    url: (r.url as string) ?? null,
    icon: (r.icon as string) ?? null,
    openInNew: Number(r.open_in_new) === 1,
    adminOnly: Number(r.admin_only) === 1,
    visible: Number(r.visible) === 1,
    sortOrder: Number(r.sort_order),
    isBoard: Number(r.is_board) === 1,
    writeRole: r.write_role === "member" ? "member" : "admin",
  };
}

export async function listMenuItems(): Promise<MenuItem[]> {
  const res = await db.execute(
    "SELECT * FROM menu_items ORDER BY sort_order, title",
  );
  return res.rows.map((r) => toItem(r as Row));
}

/** 평평한 목록을 트리로 조립한다. 부모를 잃은 항목은 최상위로 끌어올린다. */
export function buildTree(items: MenuItem[]): MenuNode[] {
  const byId = new Map<string, MenuNode>();
  for (const it of items) byId.set(it.id, { ...it, children: [] });

  const roots: MenuNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (nodes: MenuNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** 화면에 보여줄 트리. 관리자가 아니면 숨김/관리자 전용 항목을 걷어낸다. */
export function filterForViewer(nodes: MenuNode[], isAdmin: boolean): MenuNode[] {
  return nodes
    .filter((n) => isAdmin || (n.visible && !n.adminOnly))
    .map((n) => ({ ...n, children: filterForViewer(n.children, isAdmin) }));
}

export async function getMenuTree(isAdmin: boolean): Promise<MenuNode[]> {
  return filterForViewer(buildTree(await listMenuItems()), isAdmin);
}

export async function createMenuItem(input: {
  parentId?: string | null;
  title: string;
  url?: string | null;
  icon?: string | null;
  openInNew?: boolean;
  adminOnly?: boolean;
  isBoard?: boolean;
  writeRole?: WriteRole;
}): Promise<string> {
  const parentId = input.parentId || null;
  const res = await db.execute({
    sql: "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM menu_items WHERE parent_id IS ?",
    args: [parentId],
  });
  const next = Number((res.rows[0] as Row).next);
  const id = newId();

  await db.execute({
    sql: `INSERT INTO menu_items
            (id, parent_id, title, url, icon, open_in_new, admin_only, visible, sort_order,
             is_board, write_role)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    args: [
      id,
      parentId,
      input.title.trim(),
      // 게시판은 앱 안에서 열리므로 외부 주소를 갖지 않는다.
      input.isBoard ? null : input.url?.trim() || null,
      input.icon?.trim() || null,
      input.openInNew ? 1 : 0,
      input.adminOnly ? 1 : 0,
      next,
      input.isBoard ? 1 : 0,
      input.writeRole === "member" ? "member" : "admin",
    ],
  });
  return id;
}

export async function updateMenuItem(
  id: string,
  patch: {
    title?: string;
    url?: string | null;
    icon?: string | null;
    openInNew?: boolean;
    adminOnly?: boolean;
    visible?: boolean;
    parentId?: string | null;
    isBoard?: boolean;
    writeRole?: WriteRole;
  },
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.title !== undefined) {
    sets.push("title = ?");
    args.push(patch.title.trim());
  }
  if (patch.url !== undefined) {
    sets.push("url = ?");
    args.push(patch.url?.trim() || null);
  }
  if (patch.icon !== undefined) {
    sets.push("icon = ?");
    args.push(patch.icon?.trim() || null);
  }
  if (patch.openInNew !== undefined) {
    sets.push("open_in_new = ?");
    args.push(patch.openInNew ? 1 : 0);
  }
  if (patch.adminOnly !== undefined) {
    sets.push("admin_only = ?");
    args.push(patch.adminOnly ? 1 : 0);
  }
  if (patch.visible !== undefined) {
    sets.push("visible = ?");
    args.push(patch.visible ? 1 : 0);
  }
  if (patch.parentId !== undefined) {
    sets.push("parent_id = ?");
    args.push(patch.parentId || null);
  }
  if (patch.isBoard !== undefined) {
    sets.push("is_board = ?");
    args.push(patch.isBoard ? 1 : 0);
    // 게시판으로 바꾸면 외부 주소는 의미가 없어지므로 비운다.
    if (patch.isBoard) {
      sets.push("url = NULL");
    }
  }
  if (patch.writeRole !== undefined) {
    sets.push("write_role = ?");
    args.push(patch.writeRole === "member" ? "member" : "admin");
  }
  if (!sets.length) return;

  sets.push("updated_at = datetime('now')");
  args.push(id);
  await db.execute({
    sql: `UPDATE menu_items SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

/** 이 항목과 그 아래 모든 자손의 id. */
async function withDescendants(id: string): Promise<string[]> {
  const all = await listMenuItems();
  const doomed = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const it of all) {
      if (it.parentId && doomed.has(it.parentId) && !doomed.has(it.id)) {
        doomed.add(it.id);
        grew = true;
      }
    }
  }
  return [...doomed];
}

/** 삭제를 막아야 할 때 던진다. API가 사람 말로 바꿔 내려보낸다. */
export class MenuDeleteBlocked extends Error {}

/**
 * 메뉴를 지운다. ON DELETE CASCADE가 켜져 있지 않을 수 있어 자손을 직접 훑는다.
 *
 * 글이 남아 있는 게시판은 지우지 않는다. 메뉴는 다시 만들면 그만이지만
 * 글은 그렇지 않다. 당장 안 보이게만 하려면 '메뉴에 표시'를 끄면 된다.
 */
export async function deleteMenuItem(id: string): Promise<void> {
  const doomed = await withDescendants(id);

  const res = await db.execute({
    sql: `SELECT m.title AS title, count(p.id) AS n
            FROM menu_items m
            JOIN posts p ON p.board_id = m.id AND p.deleted_at IS NULL
           WHERE m.id IN (${doomed.map(() => "?").join(",")})
           GROUP BY m.id`,
    args: doomed,
  });

  if (res.rows.length) {
    const detail = res.rows
      .map((r) => `'${String((r as Row).title)}' ${Number((r as Row).n)}건`)
      .join(", ");
    throw new MenuDeleteBlocked(
      `글이 남아 있는 게시판은 지울 수 없습니다 (${detail}). ` +
        `글을 먼저 옮기거나 지운 뒤에 다시 시도하세요. ` +
        `당장 감추기만 하려면 '메뉴에 표시'를 끄면 됩니다.`,
    );
  }

  for (const victim of doomed) {
    await db.execute({ sql: "DELETE FROM menu_items WHERE id = ?", args: [victim] });
  }
}

/** 같은 부모 안에서 한 칸 위/아래로 옮긴다. */
export async function moveMenuItem(id: string, direction: "up" | "down"): Promise<void> {
  const all = await listMenuItems();
  const target = all.find((i) => i.id === id);
  if (!target) return;

  const siblings = all
    .filter((i) => i.parentId === target.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const index = siblings.findIndex((i) => i.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return;

  [siblings[index], siblings[swapWith]] = [siblings[swapWith], siblings[index]];

  // 순서를 0부터 다시 매겨 저장한다. 기존 값이 중복이어도 여기서 정리된다.
  for (let i = 0; i < siblings.length; i++) {
    await db.execute({
      sql: "UPDATE menu_items SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
      args: [i, siblings[i].id],
    });
  }
}
