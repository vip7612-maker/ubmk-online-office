import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { getViewer } from "@/lib/guard";
import { buildTree, listMenuItems } from "@/lib/menu";
import { listMembers } from "@/lib/members";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role !== "admin") redirect("/");

  const [tree, members] = await Promise.all([
    listMenuItems().then(buildTree),
    listMembers(),
  ]);

  return (
    <div className="min-h-full">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            <ArrowLeft size={15} />
            교무실로
          </Link>
          <div className="h-4 w-px bg-ink-200" />
          <h1 className="text-[15px] font-bold text-ink-900">관리자 페이지</h1>
          <span className="ml-auto truncate text-[12.5px] text-ink-400">{viewer.email}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-7">
        <AdminTabs initialTree={tree} initialMembers={members} viewerId={viewer.id} />
      </main>
    </div>
  );
}
