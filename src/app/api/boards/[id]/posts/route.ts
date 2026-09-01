import { canRead, canWrite, getBoard } from "@/lib/board-access";
import { isResponse, requireViewer } from "@/lib/guard";
import { createPost, listPosts } from "@/lib/posts";
import { attachToPost } from "@/lib/attachments";
import { htmlToText, sanitizePostHtml } from "@/lib/sanitize";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;

  const { id } = await ctx.params;
  const board = await getBoard(id);
  if (!board) return Response.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
  if (!canRead(board, viewer)) {
    return Response.json({ error: "볼 수 있는 권한이 없습니다." }, { status: 403 });
  }

  const page = Number(new URL(req.url).searchParams.get("page") ?? "1");
  return Response.json({
    board: { id: board.id, title: board.title },
    canWrite: canWrite(board, viewer),
    ...(await listPosts(id, page)),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;

  const { id } = await ctx.params;
  const board = await getBoard(id);
  if (!board) return Response.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
  if (!canWrite(board, viewer)) {
    return Response.json({ error: "글을 쓸 수 있는 권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  // 편집기가 준 HTML은 믿지 않는다. 허용 목록만 남기고 걸러 낸다.
  const content = sanitizePostHtml(typeof body?.content === "string" ? body.content : "");
  if (!title) return Response.json({ error: "제목을 입력하세요." }, { status: 400 });
  if (!htmlToText(content)) {
    return Response.json({ error: "내용을 입력하세요." }, { status: 400 });
  }

  const postId = await createPost({
    boardId: id,
    title,
    content,
    authorId: viewer.id,
    authorName: viewer.name ?? viewer.email,
    // 고정은 관리자만 걸 수 있다.
    pinned: viewer.role === "admin" && Boolean(body.pinned),
  });

  if (Array.isArray(body.attachmentIds)) {
    await attachToPost(postId, body.attachmentIds.map(String), viewer.id, viewer.role === "admin");
  }

  return Response.json(
    { id: postId, canWrite: true, ...(await listPosts(id, 1)) },
    { status: 201 },
  );
}
