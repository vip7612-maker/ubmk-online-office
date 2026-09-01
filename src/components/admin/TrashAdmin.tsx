"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, RotateCcw, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/Confirm";
import type { TrashedPost } from "@/lib/posts";

/**
 * 휴지통. 지워진 글이 30일 동안 여기 머문다.
 * 되살리거나, 기다리지 않고 완전히 지울 수 있다.
 */
export function TrashAdmin() {
  const [trash, setTrash] = useState<TrashedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useConfirm();

  const run = useCallback(async (fn: () => Promise<Response>) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fn();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "처리하지 못했습니다.");
        return;
      }
      if (Array.isArray(body.trash)) setTrash(body.trash);
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run(() => fetch("/api/trash"));
  }, [run]);

  const purge = (p: TrashedPost) =>
    ask({
      title: "이 글을 완전히 지울까요?",
      detail: `'${p.title}'\n\n되돌릴 수 없습니다. 그냥 두면 ${p.daysLeft}일 뒤에 저절로 지워집니다.`,
      confirmLabel: "완전 삭제",
      danger: true,
      onConfirm: () => run(() => fetch(`/api/trash/${p.id}`, { method: "DELETE" })),
    });

  return (
    <div>
      {dialog}

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-ink-200 text-[12px] font-medium text-ink-500">
              <th className="px-4 py-3">제목</th>
              <th className="px-4 py-3">게시판</th>
              <th className="px-4 py-3">작성자</th>
              <th className="px-4 py-3">지운 사람</th>
              <th className="px-4 py-3">남은 기간</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {trash === null ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13.5px] text-ink-400">
                  불러오는 중…
                </td>
              </tr>
            ) : trash.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13.5px] text-ink-400">
                  휴지통이 비어 있습니다.
                </td>
              </tr>
            ) : (
              trash.map((p) => (
                <tr key={p.id}>
                  <td className="max-w-[280px] truncate px-4 py-3 text-[13.5px] text-ink-900">
                    {p.title}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-500">{p.boardTitle ?? "—"}</td>
                  <td className="px-4 py-3 text-[13px] text-ink-500">{p.authorName ?? "—"}</td>
                  <td className="px-4 py-3 text-[13px] text-ink-500">
                    {p.deletedByName ?? "—"}
                    <span className="block text-[11.5px] text-ink-400">
                      {p.deletedAt.slice(0, 16).replace(/-/g, ".")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${
                        p.daysLeft <= 3
                          ? "bg-red-50 text-red-700"
                          : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {p.daysLeft}일
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        disabled={busy}
                        onClick={() => void run(() => fetch(`/api/trash/${p.id}`, { method: "POST" }))}
                        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[12.5px] text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:opacity-40"
                      >
                        <RotateCcw size={13} />
                        되살리기
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => purge(p)}
                        title="완전 삭제"
                        aria-label="완전 삭제"
                        className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
        · 글을 지우면 바로 사라지지 않고 여기에 <b>30일</b> 머뭅니다. 그동안은 되살릴 수 있습니다.
        <br />· 30일이 지난 글은 매일 새벽(몽골 시간 02시) 자동으로 완전히 지워집니다.
        <br />· 휴지통은 관리자에게만 보입니다.
      </p>
    </div>
  );
}
