import { db, newId } from "@/lib/db";

export type Post = {
  id: string;
  boardId: string;
  title: string;
  content: string;
  authorId: string | null;
  authorName: string | null;
  pinned: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
};

/** 목록에 쓰는 가벼운 형태. 본문은 싣지 않는다. */
export type PostSummary = Omit<Post, "content">;

type Row = Record<string, unknown>;

export const PAGE_SIZE = 15;

function toSummary(r: Row): PostSummary {
  return {
    id: String(r.id),
    boardId: String(r.board_id),
    title: String(r.title),
    authorId: (r.author_id as string) ?? null,
    authorName: (r.author_name as string) ?? null,
    pinned: Number(r.pinned) === 1,
    views: Number(r.views),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function toPost(r: Row): Post {
  return { ...toSummary(r), content: String(r.content) };
}

/**
 * 한 페이지 분량의 글 목록.
 * 고정 글은 페이지와 상관없이 늘 맨 위에 붙는다.
 *
 * total   — 이 게시판의 살아 있는 글 전체 (화면에 '전체 N건'으로 보여준다)
 * listed  — 고정을 뺀 글 수. 쪽 나눔과 글 번호는 이 수를 기준으로 센다.
 */
export async function listPosts(
  boardId: string,
  page = 1,
): Promise<{
  pinned: PostSummary[];
  posts: PostSummary[];
  total: number;
  listed: number;
  page: number;
  pageCount: number;
}> {
  const safePage = Math.max(1, Math.floor(page) || 1);

  const [pinnedRes, countRes] = await Promise.all([
    db.execute({
      sql: `SELECT id, board_id, title, author_id, author_name, pinned, views, created_at, updated_at
              FROM posts
             WHERE board_id = ? AND deleted_at IS NULL AND pinned = 1
             ORDER BY created_at DESC`,
      args: [boardId],
    }),
    db.execute({
      sql: "SELECT count(*) AS n FROM posts WHERE board_id = ? AND deleted_at IS NULL AND pinned = 0",
      args: [boardId],
    }),
  ]);

  const listed = Number((countRes.rows[0] as Row).n);
  const pageCount = Math.max(1, Math.ceil(listed / PAGE_SIZE));
  const offset = (Math.min(safePage, pageCount) - 1) * PAGE_SIZE;

  const res = await db.execute({
    sql: `SELECT id, board_id, title, author_id, author_name, pinned, views, created_at, updated_at
            FROM posts
           WHERE board_id = ? AND deleted_at IS NULL AND pinned = 0
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
    args: [boardId, PAGE_SIZE, offset],
  });

  const pinned = pinnedRes.rows.map((r) => toSummary(r as Row));
  return {
    pinned,
    posts: res.rows.map((r) => toSummary(r as Row)),
    total: listed + pinned.length,
    listed,
    page: Math.min(safePage, pageCount),
    pageCount,
  };
}

export async function getPost(id: string): Promise<Post | null> {
  const res = await db.execute({
    sql: "SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    args: [id],
  });
  return res.rows.length ? toPost(res.rows[0] as Row) : null;
}

/** 조회수는 실패해도 글 읽기를 막지 않는다. */
export async function bumpViews(id: string): Promise<void> {
  await db
    .execute({ sql: "UPDATE posts SET views = views + 1 WHERE id = ?", args: [id] })
    .catch(() => {});
}

export async function createPost(input: {
  boardId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string | null;
  pinned?: boolean;
}): Promise<string> {
  const id = newId();
  await db.execute({
    sql: `INSERT INTO posts (id, board_id, title, content, author_id, author_name, pinned)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.boardId,
      input.title.trim(),
      input.content,
      input.authorId,
      input.authorName,
      input.pinned ? 1 : 0,
    ],
  });
  return id;
}

export async function updatePost(
  id: string,
  patch: { title?: string; content?: string; pinned?: boolean },
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number)[] = [];

  if (patch.title !== undefined) {
    sets.push("title = ?");
    args.push(patch.title.trim());
  }
  if (patch.content !== undefined) {
    sets.push("content = ?");
    args.push(patch.content);
  }
  if (patch.pinned !== undefined) {
    sets.push("pinned = ?");
    args.push(patch.pinned ? 1 : 0);
  }
  if (!sets.length) return;

  sets.push("updated_at = datetime('now')");
  args.push(id);
  await db.execute({ sql: `UPDATE posts SET ${sets.join(", ")} WHERE id = ?`, args });
}

/** 휴지통에 남겨 두는 기간. 이 기간이 지나면 청소 작업이 완전히 지운다. */
export const TRASH_DAYS = 30;

export type TrashedPost = PostSummary & {
  boardTitle: string | null;
  deletedAt: string;
  deletedByName: string | null;
  /** 완전히 지워지기까지 남은 날수. 0이면 다음 청소 때 사라진다. */
  daysLeft: number;
};

/**
 * 글을 휴지통으로 옮긴다 — 표시만 하고 행은 남긴다.
 * 30일 안에는 관리자가 되살릴 수 있다.
 */
export async function softDeletePost(
  id: string,
  by: { id: string; name: string | null },
): Promise<void> {
  await db.execute({
    sql: `UPDATE posts
             SET deleted_at = datetime('now'), deleted_by = ?, deleted_by_name = ?
           WHERE id = ? AND deleted_at IS NULL`,
    args: [by.id, by.name, id],
  });
}

/** 휴지통 목록. 관리자만 본다. */
export async function listTrash(): Promise<TrashedPost[]> {
  const res = await db.execute(`
    SELECT p.*, m.title AS board_title,
           CAST(julianday(p.deleted_at, '+${TRASH_DAYS} days') - julianday('now') AS INTEGER) AS days_left
      FROM posts p
      LEFT JOIN menu_items m ON m.id = p.board_id
     WHERE p.deleted_at IS NOT NULL
     ORDER BY p.deleted_at DESC`);
  return res.rows.map((r) => {
    const row = r as Row;
    return {
      ...toSummary(row),
      boardTitle: (row.board_title as string) ?? null,
      deletedAt: String(row.deleted_at),
      deletedByName: (row.deleted_by_name as string) ?? null,
      daysLeft: Math.max(0, Number(row.days_left ?? 0)),
    };
  });
}

/** 휴지통에서 되살린다. */
export async function restorePost(id: string): Promise<void> {
  await db.execute({
    sql: "UPDATE posts SET deleted_at = NULL, deleted_by = NULL, deleted_by_name = NULL WHERE id = ?",
    args: [id],
  });
}

/** 되돌릴 수 없는 삭제. 휴지통 안의 글에만 쓴다. */
export async function purgePost(id: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM posts WHERE id = ? AND deleted_at IS NOT NULL",
    args: [id],
  });
}

/** 30일이 지난 휴지통 글을 실제로 지운다. 지운 글의 id 를 돌려준다. */
export async function purgeExpired(): Promise<string[]> {
  const res = await db.execute(
    `SELECT id FROM posts
      WHERE deleted_at IS NOT NULL
        AND datetime(deleted_at, '+${TRASH_DAYS} days') <= datetime('now')`,
  );
  const ids = res.rows.map((r) => String((r as Row).id));
  for (const id of ids) {
    await db.execute({ sql: "DELETE FROM posts WHERE id = ?", args: [id] });
  }
  return ids;
}

/** 게시판을 지워도 되는지 판단할 때 쓴다. */
export async function countLivePosts(boardId: string): Promise<number> {
  const res = await db.execute({
    sql: "SELECT count(*) AS n FROM posts WHERE board_id = ? AND deleted_at IS NULL",
    args: [boardId],
  });
  return Number((res.rows[0] as Row).n);
}
