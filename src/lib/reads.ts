import { db } from "@/lib/db";

export type Reader = { name: string; email: string | null; readAt: string | null };

export type ReadSummary = {
  /** 이 글을 열어 본 사람 수. 모두에게 보인다. */
  readCount: number;
  /** 지금 쓰고 있는 구성원 수(사용 중지된 사람 제외). */
  memberCount: number;
};

export type ReadDetail = ReadSummary & {
  readers: Reader[];
  unread: Reader[];
};

type Row = Record<string, unknown>;

/**
 * 글을 열어 본 사실을 남긴다. 한 사람당 한 번만 기록되고,
 * 실패해도 글 읽기를 막지 않는다.
 */
export async function recordRead(
  postId: string,
  member: { id: string; name: string | null },
): Promise<void> {
  await db
    .execute({
      sql: `INSERT INTO post_reads (post_id, member_id, member_name)
            VALUES (?, ?, ?)
            ON CONFLICT(post_id, member_id) DO NOTHING`,
      args: [postId, member.id, member.name],
    })
    .catch(() => {});
}

export async function readSummary(postId: string): Promise<ReadSummary> {
  const [reads, members] = await Promise.all([
    db.execute({
      sql: "SELECT count(*) AS n FROM post_reads WHERE post_id = ?",
      args: [postId],
    }),
    db.execute("SELECT count(*) AS n FROM members WHERE active = 1"),
  ]);
  return {
    readCount: Number((reads.rows[0] as Row).n),
    memberCount: Number((members.rows[0] as Row).n),
  };
}

/** 이름까지 담은 상세. 글쓴이와 관리자에게만 내려보낸다. */
export async function readDetail(postId: string): Promise<ReadDetail> {
  const [readRes, memberRes] = await Promise.all([
    db.execute({
      sql: `SELECT r.member_id, r.member_name, r.read_at, m.email, m.name AS current_name
              FROM post_reads r
              LEFT JOIN members m ON m.id = r.member_id
             WHERE r.post_id = ?
             ORDER BY r.read_at`,
      args: [postId],
    }),
    db.execute("SELECT id, name, email FROM members WHERE active = 1 ORDER BY name, email"),
  ]);

  const readIds = new Set(readRes.rows.map((r) => String((r as Row).member_id)));

  const readers: Reader[] = readRes.rows.map((r) => {
    const row = r as Row;
    return {
      // 지금 이름을 우선 쓰되, 구성원이 지워졌으면 읽을 당시 이름을 남긴다.
      name: String(row.current_name ?? row.member_name ?? "(탈퇴한 구성원)"),
      email: (row.email as string) ?? null,
      readAt: (row.read_at as string) ?? null,
    };
  });

  const unread: Reader[] = memberRes.rows
    .filter((r) => !readIds.has(String((r as Row).id)))
    .map((r) => {
      const row = r as Row;
      return {
        name: String(row.name ?? row.email),
        email: (row.email as string) ?? null,
        readAt: null,
      };
    });

  return {
    readCount: readers.length,
    memberCount: memberRes.rows.length,
    readers,
    unread,
  };
}
