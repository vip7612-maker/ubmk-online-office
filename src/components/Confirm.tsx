"use client";

import { useCallback, useState } from "react";
import { CircleAlert } from "lucide-react";

export type ConfirmRequest = {
  title: string;
  detail?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

/**
 * 앱 안에서 그리는 확인창.
 *
 * window.confirm 을 쓰지 않는 이유: 브라우저가 '이 사이트의 대화상자를 더 보지 않기'로
 * 막아 버리면 아무 말 없이 false 를 돌려준다. 그러면 삭제 버튼이 먹통이 된 것처럼 보인다.
 */
export function useConfirm() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = useCallback((r: ConfirmRequest) => setReq(r), []);

  const dialog = req ? (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        aria-label="닫기"
        onClick={() => !busy && setReq(null)}
        className="absolute inset-0 cursor-default bg-ink-950/45"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full max-w-[380px] rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              req.danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
            }`}
          >
            <CircleAlert size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-snug text-ink-900">{req.title}</p>
            {req.detail && (
              <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-500">
                {req.detail}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setReq(null)}
            disabled={busy}
            className="rounded-lg border border-ink-300 px-3.5 py-2 text-[13px] font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            autoFocus
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await req.onConfirm();
                setReq(null);
              } finally {
                setBusy(false);
              }
            }}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 ${
              req.danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {busy ? "처리 중…" : (req.confirmLabel ?? "확인")}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, dialog };
}
