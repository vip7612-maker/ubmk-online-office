export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500 text-[13px] font-bold tracking-tight text-white shadow-sm">
        U
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[15px] font-bold tracking-tight text-white">UBMK</span>
        <span className="text-[11px] font-medium text-ink-300">온라인교무실</span>
      </span>
    </span>
  );
}
