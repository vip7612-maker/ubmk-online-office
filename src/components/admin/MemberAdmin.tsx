"use client";

import { useState } from "react";
import { CircleAlert, Shield, Trash2, UserPlus } from "lucide-react";
import { useConfirm } from "@/components/Confirm";
import type { Member, Role } from "@/lib/members";

export function MemberAdmin({
  members,
  setMembers,
  viewerId,
}: {
  members: Member[];
  setMembers: (m: Member[]) => void;
  viewerId: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { ask, dialog } = useConfirm();

  /** 요청을 보내고, 응답에 실려 온 최신 명단으로 화면을 갈아 끼운다. */
  const run = async (fn: () => Promise<Response>) => {
    setError(null);
    setPending(true);
    try {
      const res = await fn();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "처리하지 못했습니다.");
        return false;
      }
      if (Array.isArray(body.members)) setMembers(body.members);
      return true;
    } catch {
      setError("서버에 연결하지 못했습니다.");
      return false;
    } finally {
      setPending(false);
    }
  };

  const patch = (id: string, input: Record<string, unknown>) =>
    run(() =>
      fetch(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );

  const remove = (m: Member) =>
    ask({
      title: `${m.name ?? m.email} 님을 목록에서 삭제할까요?`,
      detail: `${m.email}\n\n이 사람이 쓴 글은 그대로 남습니다. 다시 로그인하면 새로 등록되니, 아예 막으려면 삭제 대신 '사용'을 끄세요.`,
      confirmLabel: "삭제",
      danger: true,
      onConfirm: () => run(() => fetch(`/api/members/${m.id}`, { method: "DELETE" })).then(() => {}),
    });

  return (
    <div>
      {dialog}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-ink-800"
        >
          <UserPlus size={15} />
          구성원 추가
        </button>
        {pending && <span className="text-[12.5px] text-ink-400">저장 중…</span>}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {adding && (
        <AddForm
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const ok = await run(() =>
              fetch("/api/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
              }),
            );
            if (ok) setAdding(false);
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr className="border-b border-ink-200 text-[12px] font-medium text-ink-500">
              <th className="px-4 py-3">이름 / 이메일</th>
              <th className="px-4 py-3">부서</th>
              <th className="px-4 py-3">권한</th>
              <th className="px-4 py-3">사용</th>
              <th className="px-4 py-3">최근 접속</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13.5px] text-ink-400">
                  아직 등록된 구성원이 없습니다. 구글로 로그인하면 자동으로 추가됩니다.
                </td>
              </tr>
            ) : (
              members.map((m) => {
                const isSelf = m.id === viewerId;
                return (
                  <tr key={m.id} className={m.active ? "" : "bg-ink-50/60"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13.5px] font-medium text-ink-900">
                          {m.name ?? "—"}
                        </span>
                        {m.role === "admin" && (
                          <Shield size={12} className="text-violet-500" aria-label="관리자" />
                        )}
                        {isSelf && (
                          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10.5px] font-medium text-brand-700">
                            나
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-ink-400">{m.email}</div>
                    </td>

                    <td className="px-4 py-3">
                      <InlineText
                        value={m.department ?? ""}
                        placeholder="—"
                        onSave={(v) => patch(m.id, { department: v })}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={m.role}
                        disabled={isSelf}
                        onChange={(e) => patch(m.id, { role: e.target.value as Role })}
                        className="rounded-lg border border-ink-300 bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-brand-500 disabled:opacity-50"
                      >
                        <option value="member">일반</option>
                        <option value="admin">관리자</option>
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        disabled={isSelf}
                        onClick={() => patch(m.id, { active: !m.active })}
                        title={m.active ? "사용 중지" : "사용 허용"}
                        className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${
                          m.active ? "bg-brand-500" : "bg-ink-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            m.active ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </td>

                    <td className="px-4 py-3 text-[12.5px] text-ink-500">
                      {m.lastLoginAt ? m.lastLoginAt.slice(0, 16) : "—"}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={isSelf}
                        onClick={() => remove(m)}
                        title="삭제"
                        aria-label="삭제"
                        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-25"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
        · @ubmk.net 계정은 첫 로그인 때 자동으로 등록됩니다. 미리 추가해 두고 부서·권한을
        지정해 둘 수도 있습니다.
        <br />· <b>사용</b>을 끄면 도메인이 맞아도 로그인이 막힙니다.
        <br />· 환경변수 <code className="rounded bg-ink-100 px-1">ADMIN_EMAILS</code>에 적힌
        이메일은 로그인할 때마다 관리자로 되돌아갑니다.
      </p>
    </div>
  );
}

function AddForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit({ email, name, department, role });
        setBusy(false);
      }}
      className="mb-4 rounded-xl border border-ink-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="이메일">
          <input
            autoFocus
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@ubmk.net"
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-[13.5px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </Field>
        <Field label="이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-[13.5px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </Field>
        <Field label="부서">
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="교무부"
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-[13.5px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </Field>
        <Field label="권한">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13.5px] outline-none focus:border-brand-500"
          >
            <option value="member">일반</option>
            <option value="admin">관리자</option>
          </select>
        </Field>
      </div>

      <div className="mt-3.5 flex gap-2">
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? "추가 중…" : "추가"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-ink-300 px-3.5 py-2 text-[13px] font-medium text-ink-600 transition-colors hover:bg-ink-50"
        >
          취소
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}

/** 클릭하면 입력칸이 되고, 포커스를 잃거나 Enter를 누르면 저장한다. */
function InlineText({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="rounded px-1.5 py-1 text-[13px] text-ink-700 hover:bg-ink-100"
      >
        {value || <span className="text-ink-300">{placeholder}</span>}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-28 rounded-lg border border-brand-500 px-2 py-1 text-[13px] outline-none ring-2 ring-brand-500/20"
    />
  );
}
