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

/**
 * 글을 지운다 — 표시만 하고 행은 남긴다.
 * 실수로 지웠을 때 db/README 의 복구 쿼리로 되살릴 수 있다.
 */
export async function softDeletePost(id: string): Promise<void> {
  await db.execute({
    sql: "UPDATE posts SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
    args: [id],
  });
}

/** 게시판을 지워도 되는지 판단할 때 쓴다. */
export async function countLivePosts(boardId: string): Promise<number> {
  const res = await db.execute({
    sql: "SELECT count(*) AS n FROM posts WHERE board_id = ? AND deleted_at IS NULL",
    args: [boardId],
  });
  return Number((res.rows[0] as Row).n);
}
