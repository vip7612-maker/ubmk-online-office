import { canRead, canWrite, getBoard } from "@/lib/board-access";
import { isResponse, requireViewer } from "@/lib/guard";
import { bumpViews, getPost, softDeletePost, updatePost } from "@/lib/posts";

type Ctx = { params: Promise<{ id: string }> };

/** 글쓴이 본인이거나 관리자면 고칠 수 있다. */
function mayEdit(authorId: string | null, viewerId: string, isAdmin: boolean) {
  return isAdmin || (authorId !== null && authorId === viewerId);
}

export async function GET(_req: Request, ctx: Ctx) {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;

  const { id } = await ctx.params;
  const post = await getPost(id);
  if (!post) return Response.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  const board = await getBoard(post.boardId);
  if (!board || !canRead(board, viewer)) {
    return Response.json({ error: "볼 수 있는 권한이 없습니다." }, { status: 403 });
  }

  await bumpViews(id);
  return Response.json({
    post: { ...post, views: post.views + 1 },
    mayEdit: mayEdit(post.authorId, viewer.id, viewer.role === "admin"),
    mayPin: viewer.role === "admin",
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;

  const { id } = await ctx.params;
  const post = await getPost(id);
  if (!post) return Response.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  const board = await getBoard(post.boardId);
  if (!board || !canWrite(board, viewer)) {
    return Response.json({ error: "고칠 수 있는 권한이 없습니다." }, { status: 403 });
  }
  if (!mayEdit(post.authorId, viewer.id, viewer.role === "admin")) {
    return Response.json({ error: "내가 쓴 글만 고칠 수 있습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  if (typeof body.title === "string" && !body.title.trim()) {
    return Response.json({ error: "제목은 비울 수 없습니다." }, { status: 400 });
  }

  await updatePost(id, {
    ...(body.title !== undefined ? { title: String(body.title) } : {}),
    ...(body.content !== undefined ? { content: String(body.content) } : {}),
    // 고정은 관리자만 바꿀 수 있다.
    ...(body.pinned !== undefined && viewer.role === "admin"
      ? { pinned: Boolean(body.pinned) }
      : {}),
  });

  const saved = await getPost(id);
  return Response.json({ post: saved, mayEdit: true, mayPin: viewer.role === "admin" });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;

  const { id } = await ctx.params;
  const post = await getPost(id);
  if (!post) return Response.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });

  const board = await getBoard(post.boardId);
  if (!board || !mayEdit(post.authorId, viewer.id, viewer.role === "admin")) {
    return Response.json({ error: "내가 쓴 글만 지울 수 있습니다." }, { status: 403 });
  }

  // 행은 남기고 표시만 한다 — 실수로 지운 글을 되살릴 수 있게.
  await softDeletePost(id);
  return Response.json({ ok: true, boardId: post.boardId });
}
