import type { LucideIcon } from "lucide-react";

interface Stat {
  label: string;
  value: string | number;
  icon: LucideIcon;
  detail?: string;
  tone?: "cocoa" | "green" | "amber" | "navy";
}

export function ModuleStats({ items, loading = false }: { items: Stat[]; loading?: boolean }) {
  return (
    <div className="silva-module-stats grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value, detail, icon: Icon, tone = "cocoa" }) => (
        <div key={label} className="silva-stat-card flex min-w-0 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-tone={tone}>
          <span className="silva-stat-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><Icon className="h-6 w-6" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-600">{label}</p>
            <p className="mt-1 truncate text-2xl font-extrabold leading-tight tracking-tight text-slate-950" title={String(value)}>{loading ? "…" : value}</p>
            {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
