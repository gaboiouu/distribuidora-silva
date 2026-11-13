import { useEffect, useState } from "react";
import {
  ChartNoAxesCombined,
  Package,
  RefreshCw,
  ShoppingCart,
  Table2,
  Wallet,
} from "lucide-react";
import { api } from "../../services/api";
import type { FinancePeriod } from "../../types";

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const pen = (value: string | number) => `S/ ${Number(value).toLocaleString("es-PE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;
const compactPen = (value: number) =>
  `S/ ${value.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;

function InvestmentChart({ periods }: { periods: FinancePeriod[] }) {
  const values = periods.flatMap((period) => [Number(period.investment), Number(period.goodsCost)]);
  const max = Math.max(1, ...values);
  const hasData = values.some((value) => value !== 0);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <Wallet className="mt-0.5 h-6 w-6 text-[#8b4d31]" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">Inversión y costo vendido</h2>
          <p className="mt-1 text-sm text-slate-500">Mercadería comprada y costo de productos vendidos por mes</p>
        </div>
      </div>
      {hasData ? (
        <div className="mt-7">
          <div className="flex h-64 items-end gap-1 border-b border-[#d9cabd] sm:gap-2" role="img" aria-label="Comparación mensual de compras de mercadería y costo de lo vendido">
            {periods.map((period) => (
              <div key={period.month} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 sm:gap-1" title={`${months[period.month - 1]}: compras ${pen(period.investment)}, costo vendido ${pen(period.goodsCost)}`}>
                <div className="w-2/5 max-w-6 rounded-t bg-[#a96643]" style={{ height: `${Number(period.investment) === 0 ? 0 : Math.max(2, Number(period.investment) / max * 100)}%` }} />
                <div className="w-2/5 max-w-6 rounded-t bg-[#d8b69c]" style={{ height: `${Number(period.goodsCost) === 0 ? 0 : Math.max(2, Number(period.goodsCost) / max * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-12 gap-1 text-center text-[10px] font-semibold text-slate-500 sm:text-xs">
            {months.map((month) => <span key={month}>{month.slice(0, 3)}</span>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-5 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#a96643]" /> Compras de mercadería</span>
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#d8b69c]" /> Costo vendido</span>
          </div>
        </div>
      ) : <p className="flex h-72 items-center justify-center text-sm text-slate-500">Aún no hay compras ni ventas registradas en este año.</p>}
    </section>
  );
}

function ProfitExpensesChart({ periods }: { periods: FinancePeriod[] }) {
  const gross = periods.map((period) => Number(period.revenue) - Number(period.goodsCost));
  const expenses = periods.map((period) => Number(period.expenses));
  const values = [...gross, ...expenses];
  const hasData = values.some((value) => value !== 0);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const w = 720;
  const h = 240;
  const pad = 18;
  const point = (index: number, value: number) => ({
    x: pad + index * (w - 2 * pad) / 11,
    y: h - pad - (value - min) / (max - min) * (h - 2 * pad),
  });
  const path = (series: number[]) => series.map((value, index) => {
    const { x, y } = point(index, value);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <ChartNoAxesCombined className="mt-0.5 h-6 w-6 text-[#8b4d31]" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-bold">Ganancia bruta y gastos</h2>
          <p className="mt-1 text-sm text-slate-500">Ganancia antes de gastos frente a gastos operativos</p>
        </div>
      </div>
      {hasData ? (
        <div className="mt-7">
          <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Evolución mensual de ganancia bruta y gastos operativos" className="h-64 w-full overflow-visible">
            {[0, 1, 2, 3].map((step) => {
              const y = pad + step * (h - 2 * pad) / 3;
              return <line key={step} x1={pad} x2={w - pad} y1={y} y2={y} stroke="#e9ded5" strokeDasharray="4 5" />;
            })}
            <path d={path(gross)} fill="none" stroke="#673b2b" strokeWidth="3" strokeLinejoin="round" />
            <path d={path(expenses)} fill="none" stroke="#d77a3c" strokeWidth="3" strokeLinejoin="round" />
            {gross.map((value, index) => {
              const { x, y } = point(index, value);
              return <circle key={`gross-${index}`} cx={x} cy={y} r="4" fill="white" stroke="#673b2b" strokeWidth="2"><title>{months[index]}: ganancia bruta {compactPen(value)}</title></circle>;
            })}
            {expenses.map((value, index) => {
              const { x, y } = point(index, value);
              return <circle key={`expense-${index}`} cx={x} cy={y} r="4" fill="white" stroke="#d77a3c" strokeWidth="2"><title>{months[index]}: gastos {compactPen(value)}</title></circle>;
            })}
          </svg>
          <div className="grid grid-cols-12 gap-1 text-center text-[10px] font-semibold text-slate-500 sm:text-xs">
            {months.map((month) => <span key={month}>{month.slice(0, 3)}</span>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-5 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-[#673b2b]" /> Ganancia bruta</span>
            <span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-[#d77a3c]" /> Gastos operativos</span>
          </div>
        </div>
      ) : <p className="flex h-72 items-center justify-center text-sm text-slate-500">Aún no hay movimientos para comparar.</p>}
    </section>
  );
}

export function FinanceTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<{ annual: FinancePeriod; months: FinancePeriod[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try { setData(await api.getAnnualFinance(year)); }
    catch (cause) { setData(null); setError(cause instanceof Error ? cause.message : "No se pudo cargar el resumen financiero"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [year]);
  const cards = [
    { label: "Mercadería comprada", value: data?.annual.investment, icon: Wallet, detail: "Inversión registrada en el año" },
    { label: "Ventas registradas", value: data?.annual.revenue, icon: ShoppingCart, detail: "Ventas del año" },
    { label: "Costo de lo vendido", value: data?.annual.goodsCost, icon: Package, detail: "Costo guardado al vender" },
    { label: "Ganancia estimada", value: data?.annual.estimatedProfit, icon: ChartNoAxesCombined, detail: "Tras gastos registrados" },
  ];
  const rows: { label: string; key: keyof FinancePeriod }[] = [
    { label: "Compras de mercadería", key: "investment" },
    { label: "Ventas registradas", key: "revenue" },
    { label: "Costo de lo vendido", key: "goodsCost" },
    { label: "Gastos operativos", key: "expenses" },
    { label: "Ganancia estimada", key: "estimatedProfit" },
  ];
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-[#8b4d31]">Análisis financiero</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">Inversión y Ganancias</h1>
          <p className="mt-2 text-base text-slate-500">Control de inversión, ventas, costos, gastos y ganancia de la distribuidora.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="finance-year" className="text-sm font-semibold text-slate-600">Año</label>
          <select id="finance-year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">
            {Array.from({ length: 6 }, (_, index) => currentYear - index).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button onClick={() => void load()} aria-label="Actualizar finanzas" className="rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50"><RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}. Si aparece “Cannot GET”, reinicia el backend para cargar las rutas nuevas.</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, detail }) => (
          <div key={label} className="silva-summary-card flex min-w-0 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="silva-summary-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><Icon className="h-6 w-6" /></span>
            <div className="min-w-0"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-1 truncate text-2xl font-extrabold leading-tight tracking-tight" title={data ? pen(value ?? 0) : undefined}>{loading ? "…" : data ? pen(value ?? 0) : "—"}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>
          </div>
        ))}
      </div>

      {data ? <div className="grid gap-5 2xl:grid-cols-2"><InvestmentChart periods={data.months} /><ProfitExpensesChart periods={data.months} /></div>
        : <div className="grid gap-5 2xl:grid-cols-2"><div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">{loading ? "Cargando inversión…" : "Sin datos disponibles"}</div><div className="flex h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">{loading ? "Cargando resultado…" : "Sin datos disponibles"}</div></div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 p-6"><Table2 className="h-6 w-6 text-[#8b4d31]" /><div><h2 className="text-xl font-bold">Detalle mensual</h2><p className="mt-1 text-sm text-slate-500">Comparación de inversión, ventas y resultado de {year}</p></div></div>
        <div className="overflow-x-auto">
          {data ? <table className="min-w-[1260px] w-full text-right text-sm">
            <thead><tr><th className="sticky left-0 bg-[#f7efe8] px-4 py-3 text-left">Concepto</th>{months.map((month) => <th key={month} className="px-3 py-3">{month.slice(0, 3)}</th>)}<th className="bg-[#f7efe8] px-4 py-3">Total anual</th></tr></thead>
            <tbody>{rows.map(({ label, key }) => <tr key={key} className={key === "estimatedProfit" ? "bg-[#f8eee6] font-bold" : "border-t border-slate-100"}><th className={`sticky left-0 px-4 py-3 text-left font-semibold ${key === "estimatedProfit" ? "bg-[#f8eee6]" : "bg-white"}`}>{label}</th>{data.months.map((month) => <td key={month.month} className="whitespace-nowrap px-3 py-3">{pen(month[key])}</td>)}<td className="whitespace-nowrap bg-[#fcf7f2] px-4 py-3 font-bold">{pen(data.annual[key])}</td></tr>)}</tbody>
          </table> : <p className="p-6 text-sm text-slate-500">{loading ? "Cargando detalle…" : "No hay datos disponibles."}</p>}
        </div>
      </section>
      <p className="text-sm leading-relaxed text-slate-500">Resultado gerencial estimado: ventas menos costo de lo vendido y gastos registrados. No incluye impuestos, intereses de tarjetas, pagos a proveedores ni ajustes de inventario sin costo de compra.</p>
    </div>
  );
}
