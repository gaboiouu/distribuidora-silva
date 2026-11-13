import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Banknote, Boxes, CalendarDays,
  CircleDollarSign, Clock3, Plus, RefreshCw, Truck,
} from "lucide-react";
import { api } from "../../services/api";
import type { DashboardInsights, DashboardSummary } from "../../types";

interface Props {
  onNavigateTab: (tab: string) => void;
  onOpenNewSale: () => void;
  onOpenStockAdjust: () => void;
}
const pen = (value: string | number) => `S/ ${Number(value).toLocaleString("es-PE", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;

function WeeklySales({ days }: { days: DashboardInsights["days"] }) {
  const recent = days.slice(-7);
  const max = Math.max(1, ...recent.map((day) => Number(day.total)));
  const total = recent.reduce((sum, day) => sum + Number(day.total), 0);
  const hasSales = recent.some((day) => Number(day.total) > 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">Ventas de la semana</h2><p className="mt-1 text-sm text-slate-500">Pedidos registrados en los últimos siete días</p></div>
        <span className="rounded-lg bg-[#f7ede5] px-3 py-2 text-sm font-bold text-[#8b4d31]">{pen(total)}</span>
      </div>
      {hasSales ? <>
        <div className="mt-7 flex h-56 items-end gap-2 border-b border-[#decfc2] pb-1 sm:gap-4" role="img" aria-label="Ventas de los últimos siete días">
          {recent.map((day) => {
            const value = Number(day.total);
            const label = new Date(`${day.date}T12:00:00Z`).toLocaleDateString("es-PE", { weekday: "short", timeZone: "UTC" });
            return <div key={day.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${day.date}: ${pen(value)} · ${day.orders} pedidos`}>
              <span className="text-xs font-bold text-[#673b2b] opacity-0 group-hover:opacity-100">{value ? pen(value) : ""}</span>
              <div className="w-full max-w-16 rounded-t bg-[#a96643] group-hover:bg-[#7c442f]" style={{ height: value ? `${Math.max(3, value / max * 85)}%` : "0%" }} />
              <span className="text-xs font-semibold capitalize text-slate-500">{label}</span>
            </div>;
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Importes en soles; pasa el cursor sobre una barra para ver el detalle.</p>
      </> : <div className="flex h-64 items-center justify-center text-sm text-slate-500">Aún no hay ventas en los últimos siete días.</div>}
    </div>
  );
}

export function ExecutiveDashboard({ onNavigateTab, onOpenNewSale, onOpenStockAdjust }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    const [summaryResult, insightsResult] = await Promise.allSettled([
      api.getDashboardSummary(), api.getDashboardInsights(),
    ]);
    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    else { setSummary(null); setError("No se pudo cargar el resumen de ventas e inventario."); }
    if (insightsResult.status === "fulfilled") setInsights(insightsResult.value);
    else { setInsights(null); setError("No se pudo cargar el gráfico y los productos más vendidos. Verifica que el backend actualizado esté iniciado."); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const cards = [
    { label: "Ventas de hoy", value: summary ? pen(summary.todaySalesTotal) : "—", detail: `${summary?.todaySalesCount ?? 0} pedidos hoy`, icon: Banknote, tab: "sales", tone: "cocoa" },
    { label: "Por cobrar", value: summary ? pen(summary.receivablesTotal) : "—", detail: `${summary?.receivablesCount ?? 0} pedidos con saldo`, icon: CircleDollarSign, tab: "receivables", tone: "amber" },
    { label: "Stock bajo", value: summary ? String(summary.lowStockProductsCount) : "—", detail: "Productos con 5 cajas o menos", icon: Boxes, tab: "inventory", tone: "navy" },
    { label: "Despachos pendientes", value: summary ? String(summary.pendingDeliveriesCount) : "—", detail: "Pedidos por entregar", icon: Truck, tab: "sales", tone: "green" },
  ];
  const maxBoxes = Math.max(1, ...(insights?.topProducts.map((product) => product.boxes) ?? []));
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-200 pb-6">
      <div><p className="flex items-center gap-2 text-sm font-semibold text-[#8b4d31]"><CalendarDays className="h-4 w-4" /> Panorama comercial</p><h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Resumen ejecutivo</h1><p className="mt-2 text-base text-slate-500">Ventas, cobros e inventario de Distribuciones Silva.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => void load()} aria-label="Actualizar tablero" className="rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button><button onClick={onOpenStockAdjust} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50">Ajustar stock</button><button onClick={onOpenNewSale} className="inline-flex items-center gap-2 rounded-xl bg-[#8b4d31] px-5 py-3 text-sm font-semibold text-white hover:bg-[#713c29]"><Plus className="h-4 w-4" /> Nueva venta</button></div>
    </header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, detail, icon: Icon, tab, tone }) => <button key={label} onClick={() => onNavigateTab(tab)} className="silva-summary-card group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:shadow-md" data-tone={tone}>
        <span className="silva-summary-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><Icon className="h-6 w-6" /></span>
        <span className="min-w-0"><span className="block text-sm font-semibold text-slate-600">{label}</span><strong className="mt-1 block truncate text-2xl leading-tight text-[#15243d]">{loading ? "…" : value}</strong><span className="mt-1 block text-xs text-slate-500">{detail}</span></span>
      </button>)}
    </div>
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
      {insights ? <WeeklySales days={insights.days} /> : <div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">{loading ? "Cargando ventas…" : "Sin datos para mostrar"}</div>}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Productos más vendidos</h2><p className="mt-1 text-sm text-slate-500">Cajas vendidas en los últimos 30 días</p><div className="mt-6 space-y-5">{insights?.topProducts.length ? insights.topProducts.map((product, index) => <div key={`${product.name}-${index}`} className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4e7dc] text-sm font-bold text-[#8b4d31]">{index + 1}</span><div className="min-w-0 flex-1"><div className="mb-2 flex items-center justify-between gap-2 text-sm"><span className="truncate font-semibold text-[#15243d]">{product.name}</span><span className="shrink-0 font-bold">{product.boxes} cajas</span></div><div className="h-1.5 rounded-full bg-[#f4e7dc]"><div className="h-1.5 rounded-full bg-[#a96643]" style={{ width: `${product.boxes / maxBoxes * 100}%` }} /></div></div></div>) : <p className="py-16 text-center text-sm text-slate-500">Aún no hay ventas en este período.</p>}</div></div>
    </div>
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between p-6"><div><h2 className="text-xl font-bold">Ventas recientes</h2><p className="mt-1 text-sm text-slate-500">Últimos pedidos registrados</p></div><button onClick={() => onNavigateTab("sales")} className="flex items-center gap-1 text-sm font-semibold text-[#8b4d31]">Ver ventas <ArrowRight className="h-4 w-4" /></button></div><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-[#f7efe8] text-xs uppercase text-slate-500"><tr><th className="px-6 py-3">Cliente</th><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">Total</th><th className="px-6 py-3">Cobro</th></tr></thead><tbody>{insights?.recentSales.map((sale) => <tr key={sale.id} className="border-t border-slate-100"><td className="px-6 py-4 font-semibold">{sale.customer}</td><td className="px-6 py-4 text-slate-500">{new Date(sale.createdAt).toLocaleDateString("es-PE")}</td><td className="px-6 py-4 font-semibold">{pen(sale.total)}</td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${Number(sale.paid) >= Number(sale.total) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{Number(sale.paid) >= Number(sale.total) ? "Pagado" : "Pendiente"}</span></td></tr>)}</tbody></table>{!insights?.recentSales.length && <p className="p-6 text-sm text-slate-500">Aún no hay ventas recientes.</p>}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Atención operativa</h2><p className="mt-1 text-sm text-slate-500">Tareas que requieren seguimiento</p><div className="mt-6 space-y-3">{[
        { icon: Truck, label: "Despachos pendientes", value: summary?.pendingDeliveriesCount ?? 0, tab: "sales" },
        { icon: AlertTriangle, label: "Productos con stock bajo", value: summary?.lowStockProductsCount ?? 0, tab: "inventory" },
        { icon: Clock3, label: "Comprobantes por revisar", value: summary?.sunatAttentionCount ?? 0, tab: "billing" },
      ].map(({ icon: Icon, label, value, tab }) => <button key={label} onClick={() => onNavigateTab(tab)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-4 text-left hover:bg-[#fcf8f4]"><Icon className="h-5 w-5 text-[#8b4d31]" /><span className="flex-1 text-sm font-medium">{label}</span><span className="text-lg font-bold">{summary ? value : "—"}</span></button>)}</div><button onClick={() => onNavigateTab("inventory")} className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#8b4d31]"><Boxes className="h-4 w-4" /> Ver inventario <ArrowRight className="h-4 w-4" /></button></div>
    </div>
  </div>;
}
