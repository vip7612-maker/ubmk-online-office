import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getViewer } from "@/lib/guard";
import { getMenuTree } from "@/lib/menu";
import { listFavoriteIds } from "@/lib/favorites";
import { verseOfTheDay } from "@/lib/verses";

export const dynamic = "force-dynamic";

export default async function HomePage(props: {
  searchParams: Promise<{ m?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // ?m=<메뉴id> 를 서버에서 읽어 첫 렌더부터 그 메뉴를 열어둔다.
  const [tree, favoriteIds, { m }, jar] = await Promise.all([
    getMenuTree(viewer.role === "admin"),
    listFavoriteIds(viewer.id),
    props.searchParams,
    cookies(),
  ]);

  return (
    <Shell
      tree={tree}
      viewer={viewer}
      initialId={m ?? null}
      initialFavoriteIds={favoriteIds}
      initialRailed={jar.get("office_rail")?.value === "1"}
      verse={verseOfTheDay()}
    />
  );
}
