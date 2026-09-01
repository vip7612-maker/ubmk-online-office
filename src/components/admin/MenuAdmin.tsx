"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FilePlus,
  FolderPlus,
  Link as LinkIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { useConfirm } from "@/components/Confirm";
import type { MenuNode, WriteRole } from "@/lib/menu";

type Draft = {
  title: string;
  icon: string;
  url: string;
  openInNew: boolean;
  adminOnly: boolean;
  visible: boolean;
  isBoard: boolean;
  writeRole: WriteRole;
};

export function MenuAdmin({ initialTree }: { initialTree: MenuNode[] }) {
  // 서버가 준 트리로 시작하고, 이후에는 각 요청의 응답으로 갱신한다.
  const [tree, setTree] = useState<MenuNode[]>(initialTree);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingUnder, setAddingUnder] = useState<{ parentId: string | null; isCategory: boolean } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { ask, dialog } = useConfirm();

  /** 요청을 보내고, 응답에 실려 온 최신 트리로 화면을 갈아 끼운다. */
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
      if (Array.isArray(body.tree)) setTree(body.tree);
      return true;
    } catch {
      setError("서버에 연결하지 못했습니다.");
      return false;
    } finally {
      setPending(false);
    }
  };

  const create = (input: Record<string, unknown>) =>
    run(() =>
      fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );

  const patch = (id: string, input: Record<string, unknown>) =>
    run(() =>
      fetch(`/api/menu/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );

  const remove = (node: MenuNode) =>
    ask({
      title: `'${node.title}'을(를) 삭제할까요?`,
      detail: node.children.length
        ? `하위 항목 ${node.children.length}개도 함께 삭제됩니다.\n글이 남아 있는 게시판은 삭제되지 않습니다.`
        : "글이 남아 있는 게시판은 삭제되지 않습니다.",
      confirmLabel: "삭제",
      danger: true,
      onConfirm: () => run(() => fetch(`/api/menu/${node.id}`, { method: "DELETE" })).then(() => {}),
    });

  return (
    <div>
      {dialog}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setEditing(null);
            setAddingUnder({ parentId: null, isCategory: true });
          }}
          className="flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-ink-800"
        >
          <FolderPlus size={15} />
          카테고리 추가
        </button>
        <button
          onClick={() => {
            setEditing(null);
            setAddingUnder({ parentId: null, isCategory: false });
          }}
          className="flex items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 py-2 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-50"
        >
          <FilePlus size={15} />
          메뉴 추가
        </button>
        {pending && <span className="text-[12.5px] text-ink-400">저장 중…</span>}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {addingUnder?.parentId === null && (
        <div className="mb-4">
          <ItemForm
            isCategory={addingUnder.isCategory}
            onCancel={() => setAddingUnder(null)}
            onSubmit={async (d) => {
              const ok = await create({ ...d, parentId: null });
              if (ok) setAddingUnder(null);
            }}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        {tree.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13.5px] text-ink-400">
            아직 메뉴가 없습니다. 위 버튼으로 첫 카테고리나 메뉴를 만들어 보세요.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {tree.map((node, i) => (
              <Row
                key={node.id}
                node={node}
                depth={0}
                index={i}
                siblingCount={tree.length}
                editing={editing}
                setEditing={setEditing}
                addingUnder={addingUnder}
                setAddingUnder={setAddingUnder}
                collapsed={collapsed}
                toggleCollapse={(id) => setCollapsed((p) => ({ ...p, [id]: !p[id] }))}
                onCreate={create}
                onPatch={patch}
                onRemove={remove}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
        · <b>아이콘</b>은 이모지 한 글자를 넣으면 메뉴 앞에 붙습니다. 비워두면 기본 모양이 쓰입니다.
        <br />· 주소를 비워두면 <b>카테고리</b>가 되어 하위 항목을 펼치고 접는 용도로만 쓰입니다.
        <br />· 주소가 있는 <b>메뉴</b>는 누르면 언제나 오른쪽 화면에 열립니다.
        <br />· <b>앱 안의 게시판</b>으로 두면 외부 주소 대신 이 앱에 글을 쌓는 게시판이 열립니다.
        <br />· 구글·네이버처럼 삽입을 막아둔 사이트는 오른쪽이 비어 보일 수 있습니다. 그런
        메뉴는 <b>삽입 차단 안내 표시</b>를 켜 두면 새 창으로 여는 안내가 함께 뜹니다.
        <br />· 글이 남아 있는 게시판은 지워지지 않습니다. 감추려면 <b>메뉴에 표시</b>를 끄세요.
      </p>
    </div>
  );
}

type RowProps = {
  node: MenuNode;
  depth: number;
  index: number;
  siblingCount: number;
  editing: string | null;
  setEditing: (v: string | null) => void;
  addingUnder: { parentId: string | null; isCategory: boolean } | null;
  setAddingUnder: (v: { parentId: string | null; isCategory: boolean } | null) => void;
  collapsed: Record<string, boolean>;
  toggleCollapse: (id: string) => void;
  onCreate: (input: Record<string, unknown>) => Promise<boolean>;
  onPatch: (id: string, input: Record<string, unknown>) => Promise<boolean>;
  onRemove: (node: MenuNode) => void;
};

function Row(props: RowProps) {
  const {
    node, depth, index, siblingCount, editing, setEditing,
    addingUnder, setAddingUnder, collapsed, toggleCollapse,
    onCreate, onPatch, onRemove,
  } = props;

  // 주소 유무와 하위 유무는 별개다. 주소가 있어도 하위를 달 수 있다.
  const isCategory = !node.url;
  const hasChildren = node.children.length > 0;
  const isOpen = !collapsed[node.id];
  const isEditing = editing === node.id;

  return (
    <li>
      <div
        className="flex items-center gap-2 px-3 py-2.5 hover:bg-ink-50"
        style={{ paddingLeft: 12 + depth * 22 }}
      >
        {hasChildren ? (
          <button
            onClick={() => toggleCollapse(node.id)}
            className="rounded p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700"
            aria-label={isOpen ? "접기" : "펼치기"}
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : isCategory ? (
          <span className="w-4 shrink-0" />
        ) : (
          <LinkIcon size={13} className="shrink-0 text-ink-300" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {node.icon && <span aria-hidden className="text-[14px]">{node.icon}</span>}
            <span className="truncate text-[14px] font-medium text-ink-900">{node.title}</span>
            {node.isBoard ? (
              <Badge className="bg-emerald-100 text-emerald-700">게시판</Badge>
            ) : (
              isCategory && <Badge className="bg-ink-100 text-ink-500">카테고리</Badge>
            )}
            {node.isBoard && (
              <Badge className="bg-ink-100 text-ink-500">
                쓰기 {node.writeRole === "member" ? "전체" : "관리자"}
              </Badge>
            )}
            {node.openInNew && (
              <Badge className="bg-amber-100 text-amber-700">삽입 주의</Badge>
            )}
            {node.adminOnly && (
              <Badge className="bg-violet-100 text-violet-700">관리자 전용</Badge>
            )}
            {!node.visible && <Badge className="bg-ink-200 text-ink-600">숨김</Badge>}
          </div>
          {node.url && (
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-400 hover:text-brand-600 hover:underline"
            >
              <span className="truncate">{node.url}</span>
              <ExternalLink size={10} className="shrink-0" />
            </a>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn
            title="위로"
            disabled={index === 0}
            onClick={() => onPatch(node.id, { move: "up" })}
          >
            <ArrowUp size={14} />
          </IconBtn>
          <IconBtn
            title="아래로"
            disabled={index === siblingCount - 1}
            onClick={() => onPatch(node.id, { move: "down" })}
          >
            <ArrowDown size={14} />
          </IconBtn>
          {
            <>
              <IconBtn
                title="하위 카테고리 추가"
                onClick={() => {
                  setEditing(null);
                  setAddingUnder({ parentId: node.id, isCategory: true });
                }}
              >
                <FolderPlus size={14} />
              </IconBtn>
              <IconBtn
                title="하위 메뉴 추가"
                onClick={() => {
                  setEditing(null);
                  setAddingUnder({ parentId: node.id, isCategory: false });
                }}
              >
                <FilePlus size={14} />
              </IconBtn>
            </>
          }
          <IconBtn
            title="수정"
            onClick={() => {
              setAddingUnder(null);
              setEditing(isEditing ? null : node.id);
            }}
          >
            <Pencil size={14} />
          </IconBtn>
          <IconBtn title="삭제" danger onClick={() => onRemove(node)}>
            <Trash2 size={14} />
          </IconBtn>
        </div>
      </div>

      {isEditing && (
        <div className="border-t border-ink-100 bg-ink-50 px-3 py-3" style={{ paddingLeft: 12 + depth * 22 }}>
          <ItemForm
            isCategory={isCategory}
            initial={{
              title: node.title,
              icon: node.icon ?? "",
              url: node.url ?? "",
              openInNew: node.openInNew,
              adminOnly: node.adminOnly,
              visible: node.visible,
              isBoard: node.isBoard,
              writeRole: node.writeRole,
            }}
            showVisible
            onCancel={() => setEditing(null)}
            onSubmit={async (d) => {
              const ok = await onPatch(node.id, d);
              if (ok) setEditing(null);
            }}
          />
        </div>
      )}

      {addingUnder?.parentId === node.id && (
        <div className="border-t border-ink-100 bg-ink-50 px-3 py-3" style={{ paddingLeft: 34 + depth * 22 }}>
          <ItemForm
            isCategory={addingUnder.isCategory}
            onCancel={() => setAddingUnder(null)}
            onSubmit={async (d) => {
              const ok = await onCreate({ ...d, parentId: node.id });
              if (ok) setAddingUnder(null);
            }}
          />
        </div>
      )}

      {isOpen && hasChildren && (
        <ul className="divide-y divide-ink-100 border-t border-ink-100">
          {node.children.map((child, i) => (
            <Row
              {...props}
              key={child.id}
              node={child}
              depth={depth + 1}
              index={i}
              siblingCount={node.children.length}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function ItemForm({
  isCategory,
  initial,
  showVisible = false,
  onSubmit,
  onCancel,
}: {
  isCategory: boolean;
  initial?: Draft;
  showVisible?: boolean;
  onSubmit: (d: Draft) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(
    initial ?? {
      title: "",
      icon: "",
      url: "",
      openInNew: false,
      adminOnly: false,
      visible: true,
      isBoard: false,
      writeRole: "admin",
    },
  );
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    await onSubmit(draft);
    setBusy(false);
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-ink-200 bg-white p-3.5 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-[76px_minmax(0,1fr)] lg:grid-cols-[76px_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-600">아이콘</span>
          <input
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            placeholder="📢"
            maxLength={4}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-center text-[15px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-600">이름</span>
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder={isCategory ? "예: 학사 업무" : "예: 시간표"}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-[13.5px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink-600">
            주소 {isCategory && <span className="text-ink-400">(비우면 카테고리)</span>}
          </span>
          <input
            value={draft.isBoard ? "" : draft.url}
            disabled={draft.isBoard}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            placeholder={draft.isBoard ? "게시판은 앱 안에서 열립니다" : "https://..."}
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-[13.5px] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50 disabled:text-ink-400"
          />
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
        <Check
          label="앱 안의 게시판으로 쓰기"
          checked={draft.isBoard}
          onChange={(v) => setDraft({ ...draft, isBoard: v })}
        />
        {draft.isBoard && (
          <label className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-700">
            글쓰기 권한
            <select
              value={draft.writeRole}
              onChange={(e) => setDraft({ ...draft, writeRole: e.target.value as WriteRole })}
              className="rounded-lg border border-ink-300 bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500"
            >
              <option value="admin">관리자만</option>
              <option value="member">모든 구성원</option>
            </select>
            <span className="text-[12px] text-ink-400">읽기는 메뉴가 보이는 사람 모두</span>
          </label>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {!draft.isBoard && (
          <Check
            label="삽입 차단 안내 표시"
            checked={draft.openInNew}
            onChange={(v) => setDraft({ ...draft, openInNew: v })}
          />
        )}
        <Check
          label="관리자만 보기"
          checked={draft.adminOnly}
          onChange={(v) => setDraft({ ...draft, adminOnly: v })}
        />
        {showVisible && (
          <Check
            label="메뉴에 표시"
            checked={draft.visible}
            onChange={(v) => setDraft({ ...draft, visible: v })}
          />
        )}
      </div>

      <div className="mt-3.5 flex gap-2">
        <button
          type="submit"
          disabled={busy || !draft.title.trim()}
          className="rounded-lg bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? "저장 중…" : "저장"}
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

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-ink-300 accent-brand-600"
      />
      {label}
    </label>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 transition-colors disabled:opacity-25 ${
        danger
          ? "text-ink-400 hover:bg-red-50 hover:text-red-600"
          : "text-ink-400 hover:bg-ink-200 hover:text-ink-800"
      }`}
    >
      {children}
    </button>
  );
}
