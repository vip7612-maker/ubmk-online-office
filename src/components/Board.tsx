"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useConfirm } from "@/components/Confirm";
import { RichEditor } from "@/components/RichEditor";
import type { Attachment } from "@/lib/attachments";
import type { Post, PostSummary } from "@/lib/posts";
import type { ReadDetail, ReadSummary } from "@/lib/reads";

type ListState = {
  pinned: PostSummary[];
  posts: PostSummary[];
  total: number; // 고정 글까지 포함한 전체
  listed: number; // 고정을 뺀 수 — 번호와 쪽 나눔의 기준
  page: number;
  pageCount: number;
  canWrite: boolean;
};

type PostState = {
  post: Post;
  attachments: Attachment[];
  /** 글쓴이·관리자에게는 이름까지, 그 밖에는 숫자만 온다. */
  reads: ReadSummary | ReadDetail;
  mayEdit: boolean;
  mayPin: boolean;
};

type Draft = {
  title: string;
  content: string;
  pinned: boolean;
  attachmentIds: string[];
};

type View =
  | { kind: "list" }
  | { kind: "post"; id: string }
  | { kind: "write" }
  | { kind: "edit"; post: Post };

/** 우측 패널에 뜨는 게시판. 목록 · 글 보기 · 쓰기를 한 자리에서 오간다. */
export function Board({ boardId, boardTitle }: { boardId: string; boardTitle: string }) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [list, setList] = useState<ListState | null>(null);
  const [post, setPost] = useState<PostState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useConfirm();

  const loadList = useCallback(
    async (page = 1) => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(`/api/boards/${boardId}/posts?page=${page}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "목록을 불러오지 못했습니다.");
          return;
        }
        setList(body);
      } catch {
        setError("서버에 연결하지 못했습니다.");
      } finally {
        setBusy(false);
      }
    },
    [boardId],
  );

  // 게시판이 바뀌면 목록부터 다시 시작한다.
  useEffect(() => {
    setView({ kind: "list" });
    setPost(null);
    void loadList(1);
  }, [loadList]);

  const openPost = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${id}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "글을 불러오지 못했습니다.");
        return;
      }
      setPost(body);
      setView({ kind: "post", id });
    } finally {
      setBusy(false);
    }
  };

  const backToList = () => {
    setPost(null);
    setView({ kind: "list" });
    void loadList(list?.page ?? 1);
  };

  const save = async (draft: Draft) => {
    setError(null);
    setBusy(true);
    try {
      const editing = view.kind === "edit" ? view.post : null;
      const res = await fetch(
        editing ? `/api/posts/${editing.id}` : `/api/boards/${boardId}/posts`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "저장하지 못했습니다.");
        return false;
      }
      if (editing) await openPost(editing.id);
      else {
        setView({ kind: "list" });
        setList(body);
      }
      return true;
    } catch {
      setError("서버에 연결하지 못했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = (target: Post) =>
    ask({
      title: "이 글을 휴지통으로 옮길까요?",
      detail: `'${target.title}'\n\n바로 사라지지 않고 휴지통에 30일간 보관됩니다. 그 안에는 관리자가 되살릴 수 있습니다.`,
      confirmLabel: "휴지통으로",
      danger: true,
      onConfirm: async () => {
        setError(null);
        setBusy(true);
        try {
          const res = await fetch(`/api/posts/${target.id}`, { method: "DELETE" });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(body.error ?? "지우지 못했습니다.");
            return;
          }
          setNotice(`'${target.title}' 글을 휴지통으로 옮겼습니다.`);
          backToList();
        } catch {
          setError("서버에 연결하지 못했습니다.");
        } finally {
          setBusy(false);
        }
      },
    });

  return (
    <div className="h-full overflow-y-auto bg-white">
      {dialog}
      <div className="mx-auto max-w-4xl px-6 py-7 sm:px-8">
        {notice && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
            <span className="flex-1">{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="닫기" className="shrink-0">
              <X size={14} />
            </button>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
            <CircleAlert size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {view.kind === "list" && (
          <PostList
            boardTitle={boardTitle}
            list={list}
            busy={busy}
            onOpen={openPost}
            onPage={(p) => void loadList(p)}
            onWrite={() => setView({ kind: "write" })}
          />
        )}

        {view.kind === "post" && post && (
          <PostView
            data={post}
            busy={busy}
            onBack={backToList}
            onEdit={() => setView({ kind: "edit", post: post.post })}
            onDelete={() => remove(post.post)}
          />
        )}

        {(view.kind === "write" || view.kind === "edit") && (
          <PostEditor
            boardId={boardId}
            initial={view.kind === "edit" ? view.post : null}
            initialAttachments={view.kind === "edit" ? (post?.attachments ?? []) : []}
            mayPin={view.kind === "edit" ? (post?.mayPin ?? false) : (list?.canWrite ?? false)}
            busy={busy}
            onError={setError}
            onCancel={() =>
              view.kind === "edit" ? setView({ kind: "post", id: view.post.id }) : backToList()
            }
            onSave={save}
          />
        )}
      </div>
    </div>
  );
}

function fmtDate(s: string) {
  return s.slice(0, 10).replace(/-/g, ".");
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PostList({
  boardTitle,
  list,
  busy,
  onOpen,
  onPage,
  onWrite,
}: {
  boardTitle: string;
  list: ListState | null;
  busy: boolean;
  onOpen: (id: string) => void;
  onPage: (page: number) => void;
  onWrite: () => void;
}) {
  if (!list) {
    return <p className="py-16 text-center text-[13.5px] text-ink-400">불러오는 중…</p>;
  }

  // 번호는 고정 글을 빼고 최신 글이 가장 큰 수를 갖도록 내림차순으로 매긴다.
  const firstNumber = list.listed - (list.page - 1) * 15;
  const rows = [
    ...list.pinned.map((post) => ({ post, number: 0 })),
    ...list.posts.map((post, j) => ({ post, number: firstNumber - j })),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h2 className="text-[21px] font-bold text-ink-900">{boardTitle}</h2>
          <p className="mt-1 text-[12.5px] text-ink-400">
            전체 {list.total}건 · {list.page} / {list.pageCount} 페이지
          </p>
        </div>
        {list.canWrite && (
          <button
            onClick={onWrite}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <Plus size={15} />
            글쓰기
          </button>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-ink-200">
        <div className="grid grid-cols-[72px_minmax(0,1fr)_132px_104px_66px] bg-ink-50 text-[12px] font-medium text-ink-500">
          <div className="px-3 py-3 text-center">번호</div>
          <div className="px-2 py-3">제목</div>
          <div className="px-3 py-3 text-center">작성자</div>
          <div className="px-3 py-3 text-center">등록일</div>
          <div className="px-3 py-3 text-center">조회</div>
        </div>

        {rows.length === 0 ? (
          <p className="border-t border-ink-100 px-4 py-16 text-center text-[13.5px] text-ink-400">
            아직 등록된 글이 없습니다.
            {list.canWrite && " 첫 글을 올려 보세요."}
          </p>
        ) : (
          rows.map(({ post: p, number }) => (
            <button
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="grid w-full grid-cols-[72px_minmax(0,1fr)_132px_104px_66px] items-center border-t border-ink-100 text-left transition-colors hover:bg-ink-50"
            >
              <span className="px-3 py-3.5 text-center">
                {p.pinned ? (
                  <span className="inline-block whitespace-nowrap rounded bg-brand-50 px-1.5 py-0.5 text-[11.5px] font-medium text-brand-700">
                    공지
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-400">{number}</span>
                )}
              </span>
              <span
                className={`truncate px-2 py-3.5 text-[13.5px] text-ink-900 ${
                  p.pinned ? "font-bold" : ""
                }`}
              >
                {p.title}
              </span>
              <span className="truncate px-3 py-3.5 text-center text-[13px] text-ink-500">
                {p.authorName ?? "—"}
              </span>
              <span className="px-3 py-3.5 text-center text-[13px] text-ink-400">
                {fmtDate(p.createdAt)}
              </span>
              <span className="px-3 py-3.5 text-center text-[13px] text-ink-400">{p.views}</span>
            </button>
          ))
        )}
      </div>

      {list.pageCount > 1 && (
        <div className="mt-5 flex items-center justify-center gap-1">
          <PageBtn disabled={list.page <= 1 || busy} onClick={() => onPage(list.page - 1)}>
            <ChevronLeft size={15} />
          </PageBtn>
          {Array.from({ length: list.pageCount }, (_, i) => i + 1)
            .filter((n) => Math.abs(n - list.page) <= 2 || n === 1 || n === list.pageCount)
            .map((n, i, arr) => (
              <span key={n} className="flex items-center gap-1">
                {i > 0 && arr[i - 1] !== n - 1 && <span className="px-1 text-ink-300">…</span>}
                <button
                  onClick={() => onPage(n)}
                  disabled={busy}
                  className={`grid h-[30px] min-w-[30px] place-items-center rounded-md px-1.5 text-[13px] transition-colors ${
                    n === list.page
                      ? "bg-brand-600 font-medium text-white"
                      : "text-ink-600 hover:bg-ink-100"
                  }`}
                >
                  {n}
                </button>
              </span>
            ))}
          <PageBtn
            disabled={list.page >= list.pageCount || busy}
            onClick={() => onPage(list.page + 1)}
          >
            <ChevronRight size={15} />
          </PageBtn>
        </div>
      )}
    </div>
  );
}

function PageBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="grid h-[30px] w-[30px] place-items-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function PostView({
  data,
  busy,
  onBack,
  onEdit,
  onDelete,
}: {
  data: PostState;
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { post, attachments, reads, mayEdit } = data;
  const detail = "readers" in reads ? reads : null;
  const [showReaders, setShowReaders] = useState(false);

  return (
    <article>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
      >
        <ArrowLeft size={15} />
        목록
      </button>

      <header className="mt-3 border-b border-ink-200 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {post.pinned && (
            <span className="flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-[11.5px] font-medium text-brand-700">
              <Pin size={11} />
              공지
            </span>
          )}
          <h2 className="text-[20px] font-bold leading-snug text-ink-900">{post.title}</h2>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-400">
          <span>{post.authorName ?? "—"}</span>
          <span>{post.createdAt.slice(0, 16).replace(/-/g, ".")}</span>
          <span>조회 {post.views}</span>
          {/* 읽은 사람 수는 모두에게 보인다. */}
          <span className="flex items-center gap-1">
            <Users size={12} />
            읽음 {reads.readCount} / {reads.memberCount}
          </span>
          {post.updatedAt !== post.createdAt && <span>수정됨</span>}
          {mayEdit && (
            <span className="ml-auto flex items-center gap-1">
              {detail && (
                <button
                  onClick={() => setShowReaders((v) => !v)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
                >
                  <Users size={13} />
                  {showReaders ? "명단 닫기" : "읽음 명단"}
                </button>
              )}
              <button
                onClick={onEdit}
                disabled={busy}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
              >
                <Pencil size={13} />
                수정
              </button>
              <button
                onClick={onDelete}
                disabled={busy}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
                삭제
              </button>
            </span>
          )}
        </div>
      </header>

      {/* 이름 목록은 글쓴이와 관리자에게만 내려온다. */}
      {detail && showReaders && (
        <div className="mt-4 grid gap-3 rounded-xl border border-ink-200 bg-ink-50 p-4 sm:grid-cols-2">
          <ReaderColumn
            title={`읽음 ${detail.readers.length}명`}
            people={detail.readers}
            tone="read"
          />
          <ReaderColumn
            title={`아직 안 읽음 ${detail.unread.length}명`}
            people={detail.unread}
            tone="unread"
          />
        </div>
      )}

      {/*
        본문은 편집기가 만든 HTML이다. 서버가 저장할 때와 내려보낼 때
        두 번 허용 목록으로 걸러 낸 것만 여기 들어온다.
      */}
      <div
        className="prose-board py-6 text-[14.5px] leading-[1.75] text-ink-800"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {attachments.length > 0 && (
        <div className="mb-6 rounded-xl border border-ink-200 bg-ink-50 p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-600">
            <Paperclip size={13} />
            첨부파일 {attachments.length}개
          </p>
          <ul className="flex flex-col gap-1">
            {attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={a.filename}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink-700 transition-colors hover:bg-white"
                >
                  <Download size={13} className="shrink-0 text-ink-400" />
                  <span className="truncate">{a.filename}</span>
                  <span className="shrink-0 text-[12px] text-ink-400">{fmtSize(a.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function ReaderColumn({
  title,
  people,
  tone,
}: {
  title: string;
  people: { name: string; readAt: string | null }[];
  tone: "read" | "unread";
}) {
  return (
    <div>
      <p
        className={`mb-2 text-[12.5px] font-medium ${
          tone === "read" ? "text-emerald-700" : "text-ink-500"
        }`}
      >
        {title}
      </p>
      {people.length === 0 ? (
        <p className="text-[12.5px] text-ink-400">
          {tone === "read" ? "아직 아무도 읽지 않았습니다." : "모두 읽었습니다."}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {people.map((p) => (
            <li
              key={p.name + (p.readAt ?? "")}
              title={p.readAt ? p.readAt.slice(0, 16).replace(/-/g, ".") : undefined}
              className={`rounded-md px-2 py-1 text-[12.5px] ${
                tone === "read" ? "bg-white text-ink-700" : "bg-ink-200/60 text-ink-600"
              }`}
            >
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostEditor({
  boardId,
  initial,
  initialAttachments,
  mayPin,
  busy,
  onError,
  onCancel,
  onSave,
}: {
  boardId: string;
  initial: Post | null;
  initialAttachments: Attachment[];
  mayPin: boolean;
  busy: boolean;
  onError: (m: string | null) => void;
  onCancel: () => void;
  onSave: (d: Draft) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [files, setFiles] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (chosen: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(chosen)) {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("boardId", boardId);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          onError(body.error ?? `'${file.name}' 을(를) 올리지 못했습니다.`);
          continue;
        }
        setFiles((prev) => [...prev, body.attachment]);
      }
    } finally {
      setUploading(false);
    }
  };

  // 본문에 글씨가 하나도 없으면 저장하지 않는다. 빈 태그만 있는 경우를 걸러 낸다.
  const hasBody = content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0
    || /<img\s/i.test(content);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !hasBody) return;
        await onSave({ title, content, pinned, attachmentIds: files.map((f) => f.id) });
      }}
    >
      <h2 className="text-[19px] font-bold text-ink-900">{initial ? "글 수정" : "새 글 쓰기"}</h2>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="mt-4 w-full rounded-lg border border-ink-300 px-3.5 py-2.5 text-[15px] font-medium outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />

      <div className="mt-3">
        <RichEditor
          boardId={boardId}
          initialHtml={initial?.content ?? ""}
          onChange={setContent}
          onError={onError}
        />
      </div>

      <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50"
          >
            <Paperclip size={14} />
            파일 첨부
          </button>
          <span className="text-[12px] text-ink-400">
            {uploading ? "올리는 중…" : "한 개당 20MB까지"}
          </span>
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = e.target.files;
            e.target.value = "";
            if (fs?.length) void upload(fs);
          }}
        />

        {files.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-1">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[13px]"
              >
                <Paperclip size={12} className="shrink-0 text-ink-400" />
                <span className="truncate text-ink-700">{f.filename}</span>
                <span className="shrink-0 text-[12px] text-ink-400">{fmtSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                  title="목록에서 빼기"
                  className="ml-auto shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {mayPin && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-700">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 accent-brand-600"
            />
            맨 위에 공지로 고정
          </label>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-ink-300 px-3.5 py-2 text-[13px] font-medium text-ink-600 transition-colors hover:bg-ink-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={busy || uploading || !title.trim() || !hasBody}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? "저장 중…" : initial ? "수정 저장" : "등록"}
          </button>
        </div>
      </div>
    </form>
  );
}
