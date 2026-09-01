"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Folder,
  Link as LinkIcon,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Menu as MenuIcon,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { Board } from "@/components/Board";
import { Logo } from "@/components/Logo";
import type { MenuNode } from "@/lib/menu";
import type { Viewer } from "@/lib/guard";
import type { Verse } from "@/lib/verses";
import { signOutAction } from "@/app/actions";

type Props = {
  tree: MenuNode[];
  viewer: Viewer;
  initialId: string | null;
  initialFavoriteIds: string[];
  /** 사이드바를 접어 둔 채로 시작할지. 쿠키에서 읽어 서버가 넘긴다. */
  initialRailed: boolean;
  /** 오늘의 말씀. 날짜로 고르므로 서버에서 정해 내려준다. */
  verse: Verse;
};

/** 눌렀을 때 우측에 뭔가 열리는 항목인가. 외부 주소이거나 앱 안의 게시판. */
function isOpenable(n: MenuNode): boolean {
  return Boolean(n.url) || n.isBoard;
}

/** 열 수 있는 항목만 평평하게 뽑는다. 홈 화면 카드에 쓴다. */
function flattenLinks(nodes: MenuNode[], trail: string[] = []): (MenuNode & { trail: string[] })[] {
  // 자기 자신이 열리는 항목이면 담고, 하위는 그와 상관없이 계속 훑는다.
  return nodes.flatMap((n) => [
    ...(isOpenable(n) ? [{ ...n, trail }] : []),
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

export function Shell({
  tree,
  viewer,
  initialId,
  initialFavoriteIds,
  initialRailed,
  verse,
}: Props) {
  // 서버가 넘겨준 ?m= 으로 첫 화면을 맞춘다. 없으면 홈.
  const start = initialId ? findWithTrail(tree, initialId) : null;

  const startNode = start && isOpenable(start.node) ? start.node : null;

  const [activeId, setActiveId] = useState<string | null>(startNode?.id ?? null);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((start?.trail ?? []).map((t) => [t.id, true])),
  );
  const [navOpen, setNavOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(initialFavoriteIds);
  const [railed, setRailed] = useState(initialRailed);
  // 접힌 레일에서 카테고리를 눌렀을 때 옆에 띄우는 목록
  const [railFlyout, setRailFlyout] = useState<string | null>(null);

  /** 접기/펼치기. 다음에 들어와도 같은 상태가 되도록 쿠키에 남긴다. */
  const toggleRail = () => {
    setRailed((prev) => {
      const next = !prev;
      document.cookie = `office_rail=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
    setRailFlyout(null);
  };

  const links = useMemo(() => flattenLinks(tree), [tree]);
  const active = activeId ? findWithTrail(tree, activeId) : null;

  // 탭 줄에 놓을 것들. 저장된 순서를 지키고, 사라진 메뉴는 조용히 건너뛴다.
  const favoriteNodes = useMemo(
    () =>
      favoriteIds
        .map((id) => findWithTrail(tree, id)?.node)
        .filter((n): n is MenuNode => Boolean(n) && isOpenable(n as MenuNode)),
    [favoriteIds, tree],
  );

  // 즐겨찾기에 없는 메뉴를 열었다면 임시 탭으로 보여 준다.
  const tempTab =
    active && !favoriteIds.includes(active.node.id) ? active.node : null;

  /**
   * 메뉴를 우측에 띄운다 — 외부 주소면 프레임에, 게시판이면 앱 안의 목록으로.
   * 카테고리는 펼치고 접는 역할만 하므로 여기로 오지 않는다.
   */
  const openItem = useCallback(
    (node: MenuNode) => {
      if (!isOpenable(node)) return;
      const hit = findWithTrail(tree, node.id);
      setOpen((prev) => {
        const next = { ...prev };
        hit?.trail.forEach((t) => (next[t.id] = true));
        return next;
      });
      setActiveId(node.id);
      setNavOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.set("m", node.id);
      window.history.replaceState(null, "", url.toString());
    },
    [tree],
  );

  /** 탭에 올리거나 내린다. 서버가 돌려준 목록으로 화면을 맞춘다. */
  const toggleFavorite = useCallback(async (menuItemId: string, on: boolean) => {
    // 눌렀을 때 바로 반응하도록 먼저 바꾸고, 실패하면 되돌린다.
    const before = favoriteIds;
    setFavoriteIds(on ? [...before, menuItemId] : before.filter((x) => x !== menuItemId));
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId, on }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFavoriteIds(before);
        if (body.error) alert(body.error);
        return;
      }
      setFavoriteIds(body.favoriteIds ?? before);
    } catch {
      setFavoriteIds(before);
    }
  }, [favoriteIds]);

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
      {/* 접힌 레일 — 좁은 화면에서는 쓰지 않는다(그쪽은 햄버거가 맡는다). */}
      {railed && (
        <Rail
          tree={tree}
          viewer={viewer}
          activeId={activeId}
          flyoutId={railFlyout}
          onFlyout={setRailFlyout}
          onExpand={toggleRail}
          onHome={goHome}
          onSelect={(n) => {
            openItem(n);
            setRailFlyout(null);
          }}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[268px] shrink-0 flex-col bg-ink-900 transition-transform ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        } ${railed ? "md:hidden" : "md:static md:translate-x-0"}`}
      >
        <div className="flex items-center gap-1 px-3 py-4">
          <button
            onClick={goHome}
            title="홈으로"
            aria-label="홈으로"
            className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left outline-brand-400 transition-colors hover:bg-ink-800 focus-visible:outline-2"
          >
            <Logo />
          </button>
          <button
            onClick={toggleRail}
            title="메뉴 접기"
            aria-label="메뉴 접기"
            className="hidden rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-white md:block"
          >
            <PanelLeftClose size={17} />
          </button>
          <button
            onClick={() => setNavOpen(false)}
            className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 md:hidden"
            aria-label="메뉴 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="scroll-dark flex-1 overflow-y-auto px-2.5 pb-2 pt-1">
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
                  favoriteIds={favoriteIds}
                  onToggle={(id) => setOpen((p) => ({ ...p, [id]: !p[id] }))}
                  onSelect={openItem}
                  onToggleFavorite={toggleFavorite}
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
        {/*
          디자인 D — 탭 줄이 곧 제목 줄이다. 활성 탭이 현재 위치를 말해 주므로
          따로 제목 줄을 두지 않는다. 즐겨찾기에 없는 메뉴를 열면 점선 임시 탭으로 뜬다.
        */}
        <header className="flex h-12 shrink-0 items-stretch border-b border-ink-200 bg-white pl-1 pr-1">
          <button
            onClick={() => setNavOpen(true)}
            className="my-auto ml-1 rounded-md p-1.5 text-ink-600 hover:bg-ink-100 md:hidden"
            aria-label="메뉴 열기"
          >
            <MenuIcon size={20} />
          </button>

          <div className="scroll-tabs flex min-w-0 flex-1 items-stretch overflow-x-auto">
            {favoriteNodes.length === 0 && !tempTab && (
              <span className="my-auto px-3 text-[12.5px] text-ink-300">
                자주 여는 메뉴의 ★를 누르면 여기에 고정됩니다
              </span>
            )}

            {favoriteNodes.map((n) => (
              <Tab
                key={n.id}
                node={n}
                active={n.id === activeId}
                onOpen={() => openItem(n)}
                onUnpin={() => void toggleFavorite(n.id, false)}
              />
            ))}

            {tempTab && (
              <Tab
                key={tempTab.id}
                node={tempTab}
                active
                temporary
                onOpen={() => openItem(tempTab)}
                onPin={() => void toggleFavorite(tempTab.id, true)}
              />
            )}
          </div>

          {active?.node.url && !active.node.isBoard && (
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
          {active?.node.isBoard ? (
            <Board boardId={active.node.id} boardTitle={active.node.title} />
          ) : active?.node.url ? (
            <div className="flex h-full flex-col">
              {/* 삽입이 막힐 수 있다고 표시해 둔 메뉴에만 붙는 안내 */}
              {active.node.openInNew && (
                <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12.5px] text-amber-800">
                  <span>이 사이트는 창 안에서 로그인이 풀리거나 화면이 비어 보일 수 있습니다.</span>
                  <a
                    href={active.node.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-amber-900 underline"
                  >
                    새 창에서 열기
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
              <iframe
                key={`${active.node.id}-${reloadKey}`}
                src={active.node.url}
                title={active.node.title}
                className="min-h-0 w-full flex-1 border-0 bg-white"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : (
            <HomeBoard links={links} onSelect={openItem} viewer={viewer} verse={verse} />
          )}
        </div>
      </main>
    </div>
  );
}

type TreeRowProps = {
  node: MenuNode;
  depth: number;
  activeId: string | null;
  open: Record<string, boolean>;
  favoriteIds: string[];
  onToggle: (id: string) => void;
  onSelect: (n: MenuNode) => void;
  onToggleFavorite: (menuItemId: string, on: boolean) => void;
};

function TreeRow({
  node,
  depth,
  activeId,
  open,
  favoriteIds,
  onToggle,
  onSelect,
  onToggleFavorite,
}: TreeRowProps) {
  // 주소가 있으면 링크, 없으면 카테고리. 둘은 배타적이지 않아서
  // 주소도 있고 하위도 있는 항목은 '열기'와 '펼치기'를 따로 가진다.
  const isLink = isOpenable(node);
  const hasChildren = node.children.length > 0;
  const canToggle = hasChildren || !isLink;
  const isOpen = open[node.id] ?? false;
  const isActive = activeId === node.id;
  const isFavorite = favoriteIds.includes(node.id);

  return (
    <li>
      <div
        className={`group/row flex items-center rounded-lg text-[13.5px] transition-colors ${
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
          <span className="w-[23px] shrink-0" />
        )}

        <button
          onClick={() => (isLink ? onSelect(node) : onToggle(node.id))}
          className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-0.5 pr-1 text-left"
        >
          {/* 관리자가 이모지를 지정했으면 그것을, 아니면 종류에 맞는 기본 아이콘을 쓴다. */}
          {node.icon ? (
            <span aria-hidden className="w-[17px] shrink-0 text-center text-[14px] leading-none">
              {node.icon}
            </span>
          ) : isLink ? (
            <LinkIcon size={13} className="mx-[2px] shrink-0 opacity-55" />
          ) : (
            <Folder size={13} className="mx-[2px] shrink-0 opacity-55" />
          )}
          <span className="truncate">{node.title}</span>
        </button>

        {/* 열 수 있는 메뉴만 탭에 올릴 수 있다. 평소엔 숨어 있다가 올리면 나타난다. */}
        {isLink && (
          <button
            onClick={() => onToggleFavorite(node.id, !isFavorite)}
            title={isFavorite ? "탭에서 내리기" : "탭에 고정하기"}
            aria-label={isFavorite ? "탭에서 내리기" : "탭에 고정하기"}
            aria-pressed={isFavorite}
            className={`mr-1.5 shrink-0 rounded p-1 transition-opacity ${
              isFavorite
                ? "text-amber-400 opacity-100"
                : "text-ink-400 opacity-0 hover:text-white focus-visible:opacity-100 group-hover/row:opacity-100"
            }`}
          >
            <Star size={13} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        )}
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
              favoriteIds={favoriteIds}
              onToggle={onToggle}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
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

/** 아이콘이 없으면 이름 첫 글자로 대신한다. 메뉴 이름은 관리자가 짓기 때문이다. */
function railGlyph(node: MenuNode): string {
  return node.icon?.trim() || node.title.trim().charAt(0) || "·";
}

/**
 * 접힌 사이드바. 최상위 항목만 네모로 보여 주고,
 * 카테고리를 누르면 옆에 하위 목록을 띄운다.
 */
function Rail({
  tree,
  viewer,
  activeId,
  flyoutId,
  onFlyout,
  onExpand,
  onHome,
  onSelect,
}: {
  tree: MenuNode[];
  viewer: Viewer;
  activeId: string | null;
  flyoutId: string | null;
  onFlyout: (id: string | null) => void;
  onExpand: () => void;
  onHome: () => void;
  onSelect: (n: MenuNode) => void;
}) {
  const flyout = flyoutId ? findWithTrail(tree, flyoutId)?.node : null;

  /** 이 최상위 항목 안에 지금 열려 있는 메뉴가 들어 있는가. */
  const containsActive = (n: MenuNode): boolean =>
    n.id === activeId || n.children.some(containsActive);

  return (
    <>
      <aside className="relative z-40 hidden w-14 shrink-0 flex-col items-center gap-1.5 bg-ink-900 py-3 md:flex">
        <button
          onClick={onExpand}
          title="메뉴 펼치기"
          aria-label="메뉴 펼치기"
          className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-white"
        >
          <PanelLeftOpen size={17} />
        </button>

        <button
          onClick={onHome}
          title="홈으로"
          aria-label="홈으로"
          className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-[13px] font-bold text-white shadow-sm transition-transform hover:scale-105"
        >
          U
        </button>

        <div className="my-1 h-px w-7 bg-ink-800" />

        <nav className="scroll-dark flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
          {tree.map((n) => {
            const on = containsActive(n);
            return (
              <button
                key={n.id}
                title={n.title}
                aria-label={n.title}
                onClick={() =>
                  isOpenable(n) && n.children.length === 0
                    ? onSelect(n)
                    : onFlyout(flyoutId === n.id ? null : n.id)
                }
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[14px] font-medium transition-colors ${
                  on || flyoutId === n.id
                    ? "bg-brand-500 text-white"
                    : "text-ink-300 hover:bg-ink-800 hover:text-white"
                }`}
              >
                {railGlyph(n)}
              </button>
            );
          })}
        </nav>

        {viewer.role === "admin" && (
          <Link
            href="/admin"
            title="관리자 페이지"
            aria-label="관리자 페이지"
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-white"
          >
            <Settings size={17} />
          </Link>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            title={`로그아웃 (${viewer.email})`}
            aria-label="로그아웃"
            className="grid h-9 w-9 place-items-center rounded-full bg-ink-700 text-[12px] font-medium text-ink-100 transition-colors hover:bg-ink-600"
          >
            {(viewer.name ?? viewer.email).trim().charAt(0)}
          </button>
        </form>
      </aside>

      {/* 레일에서 카테고리를 눌렀을 때 옆에 뜨는 목록 */}
      {flyout && (
        <>
          <button
            aria-label="닫기"
            onClick={() => onFlyout(null)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute left-16 top-20 z-40 w-60 rounded-xl bg-ink-800 p-2 shadow-2xl">
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium tracking-wide text-ink-400">
              {flyout.title}
            </p>
            {isOpenable(flyout) && (
              <button
                onClick={() => onSelect(flyout)}
                className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-ink-100 transition-colors hover:bg-ink-700"
              >
                <LinkIcon size={13} className="shrink-0 opacity-60" />
                {flyout.title} 열기
              </button>
            )}
            <RailBranch nodes={flyout.children} activeId={activeId} onSelect={onSelect} />
            {flyout.children.length === 0 && !isOpenable(flyout) && (
              <p className="px-2.5 py-2 text-[12.5px] text-ink-500">하위 항목 없음</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

/** 레일 옆 목록의 한 갈래. 깊이는 들여쓰기로만 나타낸다. */
function RailBranch({
  nodes,
  activeId,
  onSelect,
  depth = 0,
}: {
  nodes: MenuNode[];
  activeId: string | null;
  onSelect: (n: MenuNode) => void;
  depth?: number;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((n) => (
        <li key={n.id}>
          {isOpenable(n) ? (
            <button
              onClick={() => onSelect(n)}
              style={{ paddingLeft: 10 + depth * 12 }}
              className={`flex w-full items-center gap-2 rounded-lg py-2 pr-2.5 text-left text-[13.5px] transition-colors ${
                activeId === n.id
                  ? "bg-brand-500 font-medium text-white"
                  : "text-ink-100 hover:bg-ink-700"
              }`}
            >
              {n.icon ? (
                <span aria-hidden className="w-[17px] shrink-0 text-center text-[14px] leading-none">
                  {n.icon}
                </span>
              ) : (
                <LinkIcon size={13} className="shrink-0 opacity-55" />
              )}
              <span className="truncate">{n.title}</span>
            </button>
          ) : (
            <p
              style={{ paddingLeft: 10 + depth * 12 }}
              className="py-1.5 pr-2.5 text-[11.5px] font-medium tracking-wide text-ink-400"
            >
              {n.title}
            </p>
          )}
          {n.children.length > 0 && (
            <RailBranch nodes={n.children} activeId={activeId} onSelect={onSelect} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * 우측 상단의 탭 하나.
 * 고정된 탭은 활성일 때 채워진 별을 보여 주고, 누르면 내려간다.
 * 임시 탭(즐겨찾기에 없는 메뉴)은 점선 밑줄이고, 빈 별을 누르면 고정된다.
 */
function Tab({
  node,
  active,
  temporary,
  onOpen,
  onPin,
  onUnpin,
}: {
  node: MenuNode;
  active: boolean;
  temporary?: boolean;
  onOpen: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
}) {
  return (
    <span
      className={`flex shrink-0 items-center border-b-2 ${
        active
          ? temporary
            ? "border-dashed border-brand-600"
            : "border-brand-600"
          : "border-transparent"
      }`}
    >
      <button
        onClick={onOpen}
        className={`max-w-[190px] truncate py-0 pl-3.5 pr-1.5 text-[13.5px] transition-colors ${
          active
            ? `text-ink-900 ${temporary ? "italic" : "font-medium"}`
            : "text-ink-500 hover:text-ink-800"
        }`}
      >
        {node.title}
      </button>
      {active && (
        <button
          onClick={temporary ? onPin : onUnpin}
          title={temporary ? "탭에 고정하기" : "탭에서 내리기"}
          aria-label={temporary ? "탭에 고정하기" : "탭에서 내리기"}
          className={`mr-2 rounded p-0.5 transition-colors ${
            temporary ? "text-ink-400 hover:text-amber-500" : "text-amber-400 hover:text-amber-500"
          }`}
        >
          <Star size={12} fill={temporary ? "none" : "currentColor"} />
        </button>
      )}
      {!active && <span className="pr-2" />}
    </span>
  );
}

function HomeBoard({
  links,
  onSelect,
  viewer,
  verse,
}: {
  links: (MenuNode & { trail: string[] })[];
  onSelect: (n: MenuNode) => void;
  viewer: Viewer;
  verse: Verse;
}) {
  return (
    <div className="h-full overflow-y-auto p-6 sm:p-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-[13px] font-medium text-brand-600">UBMK 온라인교무실</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
          {viewer.name ? `${viewer.name} 선생님, 안녕하세요.` : "안녕하세요."}
        </h2>
        {/* 오늘의 말씀 — 날짜로 고르므로 하루 동안 모두 같은 구절을 본다. */}
        <figure className="mt-5 rounded-2xl border border-ink-200 bg-white p-5 sm:p-6">
          <blockquote className="text-[15.5px] leading-[1.85] text-ink-800 sm:text-[16px]">
            <span className="mr-1 text-[18px] leading-none text-brand-400">&ldquo;</span>
            {verse.text}
            <span className="ml-0.5 text-[18px] leading-none text-brand-400">&rdquo;</span>
          </blockquote>
          <figcaption className="mt-3 text-[13px] font-medium text-brand-600">
            {verse.ref}
          </figcaption>
        </figure>

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
