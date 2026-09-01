import { db, newId } from "@/lib/db";

export type Role = "admin" | "member";

export type Member = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  department: string | null;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

function toMember(r: Row): Member {
  return {
    id: String(r.id),
    email: String(r.email),
    name: (r.name as string) ?? null,
    image: (r.image as string) ?? null,
    department: (r.department as string) ?? null,
    role: r.role === "admin" ? "admin" : "member",
    active: Number(r.active) === 1,
    lastLoginAt: (r.last_login_at as string) ?? null,
    createdAt: String(r.created_at),
  };
}

/** ADMIN_EMAILS 환경변수 → 소문자 이메일 배열. 잠금 해제용 안전장치. */
export function envAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function findMemberByEmail(email: string): Promise<Member | null> {
  const res = await db.execute({
    sql: "SELECT * FROM members WHERE email = ? LIMIT 1",
    args: [email.toLowerCase()],
  });
  return res.rows.length ? toMember(res.rows[0] as Row) : null;
}

export async function listMembers(): Promise<Member[]> {
  const res = await db.execute(
    "SELECT * FROM members ORDER BY role = 'admin' DESC, name IS NULL, name, email",
  );
  return res.rows.map((r) => toMember(r as Row));
}

/**
 * 로그인한 사람을 members에 반영한다.
 * 이미 있으면 프로필/최근 접속만 갱신하고, 없으면 새로 만든다.
 * ADMIN_EMAILS에 있는 이메일은 항상 admin으로 맞춘다.
 */
export async function upsertMemberOnLogin(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<Member> {
  const email = input.email.toLowerCase();
  const forcedAdmin = envAdminEmails().includes(email);
  const existing = await findMemberByEmail(email);

  if (existing) {
    await db.execute({
      sql: `UPDATE members
              SET name = COALESCE(?, name),
                  image = COALESCE(?, image),
                  role = ?,
                  last_login_at = datetime('now')
            WHERE id = ?`,
      args: [
        input.name ?? null,
        input.image ?? null,
        forcedAdmin ? "admin" : existing.role,
        existing.id,
      ],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO members (id, email, name, image, role, active, last_login_at)
            VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
      args: [
        newId(),
        email,
        input.name ?? null,
        input.image ?? null,
        forcedAdmin ? "admin" : "member",
      ],
    });
  }

  const saved = await findMemberByEmail(email);
  if (!saved) throw new Error("구성원 저장에 실패했습니다.");
  return saved;
}

export async function createMember(input: {
  email: string;
  name?: string | null;
  department?: string | null;
  role?: Role;
}): Promise<Member> {
  const email = input.email.trim().toLowerCase();
  await db.execute({
    sql: `INSERT INTO members (id, email, name, department, role, active)
          VALUES (?, ?, ?, ?, ?, 1)`,
    args: [
      newId(),
      email,
      input.name?.trim() || null,
      input.department?.trim() || null,
      input.role === "admin" ? "admin" : "member",
    ],
  });
  const saved = await findMemberByEmail(email);
  if (!saved) throw new Error("구성원 생성에 실패했습니다.");
  return saved;
}

export async function updateMember(
  id: string,
  patch: {
    name?: string | null;
    department?: string | null;
    role?: Role;
    active?: boolean;
  },
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.name !== undefined) {
    sets.push("name = ?");
    args.push(patch.name?.trim() || null);
  }
  if (patch.department !== undefined) {
    sets.push("department = ?");
    args.push(patch.department?.trim() || null);
  }
  if (patch.role !== undefined) {
    sets.push("role = ?");
    args.push(patch.role === "admin" ? "admin" : "member");
  }
  if (patch.active !== undefined) {
    sets.push("active = ?");
    args.push(patch.active ? 1 : 0);
  }
  if (!sets.length) return;

  args.push(id);
  await db.execute({
    sql: `UPDATE members SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

export async function deleteMember(id: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM members WHERE id = ?", args: [id] });
}
