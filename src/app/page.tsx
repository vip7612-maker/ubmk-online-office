import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getViewer } from "@/lib/guard";
import { getMenuTree } from "@/lib/menu";

export const dynamic = "force-dynamic";

export default async function HomePage(props: {
  searchParams: Promise<{ m?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  // ?m=<메뉴id> 를 서버에서 읽어 첫 렌더부터 그 메뉴를 열어둔다.
  const [tree, { m }] = await Promise.all([
    getMenuTree(viewer.role === "admin"),
    props.searchParams,
  ]);

  return <Shell tree={tree} viewer={viewer} initialId={m ?? null} />;
}
