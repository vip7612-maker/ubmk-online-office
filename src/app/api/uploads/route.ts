import { put } from "@vercel/blob";
import { canWrite, getBoard } from "@/lib/board-access";
import { isResponse, requireViewer } from "@/lib/guard";
import { MAX_UPLOAD_BYTES, recordUpload } from "@/lib/attachments";

// 본문에 파일이 실려 오므로 정적 최적화 대상이 아니다.
export const dynamic = "force-dynamic";

/** 화면에 그림으로 넣을 수 있는 형식. 그 밖은 첨부로만 다룬다. */
const IMAGE_MIME = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/svg+xml",
]);

/** 브라우저에서 바로 실행될 수 있는 형식은 받지 않는다. */
const BLOCKED = /\.(html?|xhtml|svgz|js|mjs|jsx|php|phtml|jsp|asp|aspx|sh|bat|cmd|exe|dll|scr)$/i;

export async function POST(req: Request) {
  const viewer = await requireViewer();
  if (isResponse(viewer)) return viewer;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const boardId = String(form?.get("boardId") ?? "");
  if (!(file instanceof File)) {
    return Response.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  // 이 게시판에 글을 쓸 수 있는 사람만 파일을 올릴 수 있다.
  const board = await getBoard(boardId);
  if (!board) return Response.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
  if (!canWrite(board, viewer)) {
    return Response.json({ error: "파일을 올릴 권한이 없습니다." }, { status: 403 });
  }

  if (file.size === 0) {
    return Response.json({ error: "빈 파일입니다." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `파일이 너무 큽니다. ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB까지 올릴 수 있습니다.` },
      { status: 413 },
    );
  }
  if (BLOCKED.test(file.name)) {
    return Response.json(
      { error: "이 형식은 올릴 수 없습니다. 필요하면 압축해서 올려주세요." },
      { status: 415 },
    );
  }

  const asImage = String(form?.get("kind")) === "image";
  const kind: "file" | "image" = asImage && IMAGE_MIME.has(file.type) ? "image" : "file";
  // svg 는 그림으로 보이지만 스크립트를 품을 수 있어 본문 삽입에서 제외한다.
  if (asImage && file.type === "image/svg+xml") {
    return Response.json({ error: "SVG는 본문에 넣을 수 없습니다." }, { status: 415 });
  }

  try {
    const blob = await put(`ubmk-office/${boardId}/${crypto.randomUUID()}/${file.name}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type || "application/octet-stream",
    });

    const saved = await recordUpload({
      boardId,
      filename: file.name,
      url: blob.url,
      pathname: blob.pathname,
      size: file.size,
      mime: file.type || null,
      kind,
      uploadedBy: viewer.id,
      uploaderName: viewer.name ?? viewer.email,
    });

    return Response.json({ attachment: saved }, { status: 201 });
  } catch (err) {
    console.error("업로드 실패", err);
    return Response.json({ error: "파일을 저장하지 못했습니다." }, { status: 500 });
  }
}
