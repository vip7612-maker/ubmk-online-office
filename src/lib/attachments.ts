import { db, newId } from "@/lib/db";

export type Attachment = {
  id: string;
  postId: string | null;
  filename: string;
  url: string;
  size: number;
  mime: string | null;
  kind: "file" | "image";
  uploaderName: string | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

/** 한 파일의 최대 크기. Vercel 함수의 요청 본문 한도를 감안한 값이다. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function toAttachment(r: Row): Attachment {
  return {
    id: String(r.id),
    postId: (r.post_id as string) ?? null,
    filename: String(r.filename),
    url: String(r.url),
    size: Number(r.size),
    mime: (r.mime as string) ?? null,
    kind: r.kind === "image" ? "image" : "file",
    uploaderName: (r.uploader_name as string) ?? null,
    createdAt: String(r.created_at),
  };
}

export async function recordUpload(input: {
  boardId: string;
  filename: string;
  url: string;
  pathname: string;
  size: number;
  mime: string | null;
  kind: "file" | "image";
  uploadedBy: string;
  uploaderName: string | null;
}): Promise<Attachment> {
  const id = newId();
  await db.execute({
    sql: `INSERT INTO attachments
            (id, post_id, board_id, filename, url, pathname, size, mime, kind, uploaded_by, uploader_name)
          VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.boardId,
      input.filename,
      input.url,
      input.pathname,
      input.size,
      input.mime,
      input.kind,
      input.uploadedBy,
      input.uploaderName,
    ],
  });
  const saved = await getAttachment(id);
  if (!saved) throw new Error("첨부 기록에 실패했습니다.");
  return saved;
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const res = await db.execute({
    sql: "SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    args: [id],
  });
  return res.rows.length ? toAttachment(res.rows[0] as Row) : null;
}

export async function listAttachments(postId: string): Promise<Attachment[]> {
  const res = await db.execute({
    sql: `SELECT * FROM attachments
           WHERE post_id = ? AND deleted_at IS NULL AND kind = 'file'
           ORDER BY created_at`,
    args: [postId],
  });
  return res.rows.map((r) => toAttachment(r as Row));
}

/**
 * 글을 저장할 때, 그 글이 데리고 갈 첨부를 확정한다.
 * 목록에 없는 기존 첨부는 떼어 내되(post_id 해제) 파일과 기록은 남긴다.
 */
export async function attachToPost(
  postId: string,
  attachmentIds: string[],
  uploaderId: string,
  isAdmin: boolean,
): Promise<void> {
  // 남의 파일을 제 글에 끌어다 붙이지 못하게 올린 사람을 확인한다.
  const owned = attachmentIds.length
    ? await db.execute({
        sql: `SELECT id FROM attachments
               WHERE id IN (${attachmentIds.map(() => "?").join(",")})
                 AND deleted_at IS NULL
                 AND (post_id IS NULL OR post_id = ?)
                 ${isAdmin ? "" : "AND uploaded_by = ?"}`,
        args: isAdmin
          ? [...attachmentIds, postId]
          : [...attachmentIds, postId, uploaderId],
      })
    : { rows: [] as Row[] };

  const keep = new Set(owned.rows.map((r) => String((r as Row).id)));

  // 이번에 빠진 것은 연결만 끊는다. 파일은 지우지 않는다.
  await db.execute({
    sql: `UPDATE attachments SET post_id = NULL
           WHERE post_id = ? AND kind = 'file'
             ${keep.size ? `AND id NOT IN (${[...keep].map(() => "?").join(",")})` : ""}`,
    args: keep.size ? [postId, ...keep] : [postId],
  });

  for (const id of keep) {
    await db.execute({
      sql: "UPDATE attachments SET post_id = ? WHERE id = ?",
      args: [postId, id],
    });
  }
}
