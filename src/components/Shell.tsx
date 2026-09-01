"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Folder,
  Home,
  Link as LinkIcon,
  LogOut,
  Menu as MenuIcon,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import type { MenuNode } from "@/lib/menu";
import type { Viewer } from "@/lib/guard";
import { signOutAction } from "@/app/actions";

type Props = { tree: MenuNode[]; viewer: Viewer; initialId: string | null };

/** 링크(= url이 있는 항목)만 평평하게 뽑는다. 새로고침 복원과 홈 카드에 쓴다. */
function flattenLinks(nodes: MenuNode[], trail: string[] = []): (MenuNode & { trail: string[] })[] {
  // 주소가 있으면 자기 자신을 담고, 하위는 링크 여부와 상관없이 계속 훑는다.
  return nodes.flatMap((n) => [
    ...(n.url ? [{ ...n, trail }] : []),
    ...flattenLinks(n.children, [...trail, n.title]),
  ]);
}

/** id로 항목과 그 조상 경로를 찾는다. */
function findWithTrail(
  nodes: MenuNode[],
  id: string,
  trail: MenuNode[] = [],
): { node: MenuNode; trail: MenuNode[] } | null {
  for (const n of nodes) {
    if (n.id === id) return { node: n, trail };
    const hit = findWithTrail(n.children, id, [...trail, n]);
    if (hit) return hit;
  }
  return null;
}

export function Shell({ tree, viewer, initialId }: Props) {
  // 서버가 넘겨준 ?m= 으로 첫 화면을 맞춘다. 없으면 홈.
  const start = initialId ? findWithTrail(tree, initialId) : null;
  const startNode = start?.node.url ? start.node : null;

  const [activeId, setActiveId] = useState<string | null>(startNode?.id ?? null);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((start?.trail ?? []).map((t) => [t.id, true])),
  );
  const [navOpen, setNavOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const links = useMemo(() => flattenLinks(tree), [tree]);
  const active = activeId ? findWithTrail(tree, activeId) : null;

  /** 메뉴를 열고, 조상 카테고리를 모두 펼치고, 주소창에 남긴다. */
  const openItem = useCallback(
    (node: MenuNode) => {
      if (!node.url) return;
      if (node.openInNew) {
        window.open(node.url, "_blank", "noopener,noreferrer");
        return;
      }
      const hit = findWithTrail(tree, node.id);
      if (hit) {
        setOpen((prev) => {
          const next = { ...prev };
          hit.trail.forEach((t) => (next[t.id] = true));
          return next;
        });
      }
      setActiveId(node.id);
      setNavOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.set("m", node.id);
      window.history.replaceState(null, "", url.toString());
    },
    [tree],
  );

  const goHome = () => {
    setActiveId(null);
    setNavOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("m");
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="flex h-full">
      {/* 모바일에서 사이드바를 열었을 때의 뒷배경 */}
      {navOpen && (
        <button
          aria-label="메뉴 닫기"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-ink-950/50 md:hidden"
        />
      )}

      {/* ── 좌측 ─────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[268px] shrink-0 flex-col bg-ink-900 transition-transform md:static md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={goHome} className="rounded-lg outline-brand-400 focus-visible:outline-2">
            <Logo />
          </button>
          <button
            onClick={() => setNavOpen(false)}
            className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 md:hidden"
            aria-label="메뉴 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="scroll-dark flex-1 overflow-y-auto px-2.5 pb-2">
          <button
            onClick={goHome}
            className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors ${
              activeId === null
                ? "bg-brand-500 text-white"
                : "text-ink-200 hover:bg-ink-800 hover:text-white"
            }`}
          >
            <Home size={16} className="shrink-0" />홈
          </button>

          {tree.length === 0 ? (
            <p className="px-2.5 py-6 text-[12.5px] leading-relaxed text-ink-400">
              아직 메뉴가 없습니다.
              {viewer.role === "admin" && (
                <>
                  {" "}
                  <Link href="/admin" className="text-brand-400 underline">
                    관리자 페이지
                  </Link>
                  에서 추가하세요.
                </>
              )}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  activeId={activeId}
                  open={open}
                  onToggle={(id) => setOpen((p) => ({ ...p, [id]: !p[id] }))}
                  onSelect={openItem}
                />
              ))}
            </ul>
          )}
        </nav>

        <div className="border-t border-ink-800 p-2.5">
          {viewer.role === "admin" && (
            <Link
              href="/admin"
              className="mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-white"
            >
              <Settings size={16} />
              관리자 페이지
            </Link>
          )}
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">
                {viewer.name ?? viewer.email}
              </p>
              <p className="truncate text-[11px] text-ink-400">{viewer.email}</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                title="로그아웃"
                className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-white"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── 우측 ─────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-4">
          <button
            onClick={() => setNavOpen(true)}
            className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 md:hidden"
            aria-label="메뉴 열기"
          >
            <MenuIcon size={20} />
          </button>

          <div className="min-w-0 flex-1">
            {active ? (
              <div className="flex min-w-0 items-baseline gap-2">
                {active.trail.length > 0 && (
                  <span className="hidden truncate text-[12.5px] text-ink-400 sm:inline">
                    {active.trail.map((t) => t.title).join(" › ")} ›
                  </span>
                )}
                <h1 className="truncate text-[15px] font-bold text-ink-900">
                  {active.node.title}
                </h1>
              </div>
            ) : (
              <h1 className="text-[15px] font-bold text-ink-900">온라인교무실</h1>
            )}
          </div>

          {active?.node.url && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                title="새로고침"
                className="rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
              >
                <RefreshCw size={16} />
              </button>
              <a
                href={active.node.url}
                target="_blank"
                rel="noopener noreferrer"
                title="새 창에서 열기"
                className="rounded-md p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          )}
        </header>

        <div className="min-h-0 flex-1">
          {active?.node.url ? (
            <iframe
              key={`${active.node.id}-${reloadKey}`}
              src={active.node.url}
              title={active.node.title}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <HomeBoard links={links} onSelect={openItem} viewer={viewer} />
          )}
        </div>
      </main>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  activeId,
  open,
  onToggle,
  onSelect,
}: {
  node: MenuNode;
  depth: number;
  activeId: string | null;
  open: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelect: (n: MenuNode) => void;
}) {
  // 주소가 있으면 링크, 없으면 카테고리. 둘은 배타적이지 않아서
  // 주소도 있고 하위도 있는 항목은 '열기'와 '펼치기'를 따로 가진다.
  const isLink = Boolean(node.url);
  const hasChildren = node.children.length > 0;
  const canToggle = hasChildren || !isLink;
  const isOpen = open[node.id] ?? false;
  const isActive = activeId === node.id;

  return (
    <li>
      <div
        className={`flex items-center rounded-lg text-[13.5px] transition-colors ${
          isActive
            ? "bg-brand-500 font-medium text-white"
            : "text-ink-200 hover:bg-ink-800 hover:text-white"
        } ${!node.visible ? "opacity-45" : ""}`}
        style={{ paddingLeft: 10 + depth * 14 }}
      >
        {canToggle ? (
          <button
            onClick={() => onToggle(node.id)}
            aria-label={isOpen ? "접기" : "펼치기"}
            aria-expanded={isOpen}
            className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        ) : (
          <LinkIcon size={13} className="ml-1 shrink-0 opacity-60" />
        )}

        <button
          onClick={() => (isLink ? onSelect(node) : onToggle(node.id))}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pl-1.5 pr-2.5 text-left"
        >
          <span className="truncate">{node.title}</span>
          {node.openInNew && <ExternalLink size={12} className="ml-auto shrink-0 opacity-50" />}
        </button>
      </div>

      {isOpen && hasChildren && (
        <ul className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              open={open}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
      {isOpen && !hasChildren && (
        <p
          style={{ paddingLeft: 24 + depth * 14 }}
          className="py-1.5 text-[12px] text-ink-500"
        >
          하위 항목 없음
        </p>
      )}
    </li>
  );
}

function HomeBoard({
  links,
  onSelect,
  viewer,
}: {
  links: (MenuNode & { trail: string[] })[];
  onSelect: (n: MenuNode) => void;
  viewer: Viewer;
}) {
  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-[13px] font-medium text-brand-600">UBMK 온라인교무실</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
          {viewer.name ? `${viewer.name} 선생님, 안녕하세요.` : "안녕하세요."}
        </h2>
        <p className="mt-1.5 text-[14px] text-ink-500">
          왼쪽 메뉴에서 필요한 업무를 선택하면 이 자리에 열립니다.
        </p>

        {links.length > 0 && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => onSelect(l)}
                className="group flex flex-col items-start rounded-xl border border-ink-200 bg-white p-4 text-left transition-all hover:border-brand-400 hover:shadow-md"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-100 text-ink-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                  {l.openInNew ? <ExternalLink size={16} /> : <Folder size={16} />}
                </span>
                {l.trail.length > 0 && (
                  <span className="mt-3 text-[11.5px] text-ink-400">{l.trail.join(" › ")}</span>
                )}
                <span className="mt-0.5 text-[14.5px] font-semibold text-ink-900">{l.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
