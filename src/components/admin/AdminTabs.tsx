"use client";

import { useState } from "react";
import { ListTree, Trash2, Users } from "lucide-react";
import { MenuAdmin } from "@/components/admin/MenuAdmin";
import { MemberAdmin } from "@/components/admin/MemberAdmin";
import { TrashAdmin } from "@/components/admin/TrashAdmin";
import type { MenuNode } from "@/lib/menu";
import type { Member } from "@/lib/members";

type Tab = "menu" | "members" | "trash";

export function AdminTabs({
  initialTree,
  initialMembers,
  viewerId,
}: {
  initialTree: MenuNode[];
  initialMembers: Member[];
  viewerId: string;
}) {
  const [tab, setTab] = useState<Tab>("menu");
  // 탭 배지의 인원수가 편집 결과를 따라가도록 명단은 여기서 들고 있는다.
  const [members, setMembers] = useState<Member[]>(initialMembers);

  const tabClass = (t: Tab) =>
    `flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors ${
      tab === t
        ? "bg-ink-900 text-white"
        : "text-ink-500 hover:bg-ink-100 hover:text-ink-800"
    }`;

  return (
    <div>
      <div className="mb-6 flex gap-1.5">
        <button onClick={() => setTab("menu")} className={tabClass("menu")}>
          <ListTree size={15} />
          메뉴 관리
        </button>
        <button onClick={() => setTab("members")} className={tabClass("members")}>
          <Users size={15} />
          구성원 관리
          <span className="ml-0.5 rounded-full bg-black/10 px-1.5 text-[11px]">
            {members.length}
          </span>
        </button>
        <button onClick={() => setTab("trash")} className={tabClass("trash")}>
          <Trash2 size={15} />
          휴지통
        </button>
      </div>

      {tab === "menu" && <MenuAdmin initialTree={initialTree} />}
      {tab === "members" && (
        <MemberAdmin members={members} setMembers={setMembers} viewerId={viewerId} />
      )}
      {tab === "trash" && <TrashAdmin />}
    </div>
  );
}
