import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { api } from "../../services/api";
import { ModuleStats } from "../../components/ModuleStats";
import { Sale } from "../../types";

export const ReceivablesTab: React.FC = () => {
  const todayPeru = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Payment Quick Modal
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<
    "CASH" | "TRANSFER" | "YAPE" | "PLIN"
  >("CASH");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const loadReceivables = async () => {
    try {
      setLoading(true);
      const data = await api.getReceivables({ take: 100 });
      setSales(data);
    } catch (err) {
      console.error("Error al cargar cuentas por cobrar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReceivables();
  }, []);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySale || !payAmount) return;
    setSubmittingPayment(true);
    try {
      await api.addPayment(paySale.id, {
        amount: Number(payAmount).toFixed(2),
        method: payMethod,
      });
      setPaySale(null);
      setPayAmount("");
      await loadReceivables();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar abono");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filteredSales = sales.filter(
    (s) =>
      s.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.customer?.document && s.customer.document.includes(search)) ||
      (s.customer?.phone && s.customer.phone.includes(search)),
  );

  const totalReceivables = sales.reduce(
    (sum, s) => sum + (Number(s.total) - Number(s.paid)),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header and Summary */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <DollarSign className="h-7 w-7 shrink-0 text-[#8b4d31]" aria-hidden="true" />
            Cuentas por Cobrar (Créditos a Clientes)
          </h2>
          <p className="text-xs text-slate-500">
            Seguimiento de saldos pendientes y registro inmediato de abonos
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium block">
              Total Pendiente por Cobrar
            </span>
            <span className="text-2xl font-black text-amber-600">
              S/ {totalReceivables.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => void loadReceivables()}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Recargar"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <ModuleStats loading={loading} items={[
        { label: "Ventas con saldo", value: sales.length, icon: DollarSign, detail: "Registros cargados", tone: "navy" },
        { label: "Vencidas", value: sales.filter(s => s.dueAt && s.dueAt.slice(0, 10) < todayPeru).length, icon: AlertCircle, detail: "De las ventas cargadas", tone: "amber" },
        { label: "Total pendiente", value: `S/ ${totalReceivables.toFixed(2)}`, icon: Calendar, detail: "De las ventas cargadas" },
      ]} />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por cliente, documento o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Receivables Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && sales.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            Cargando cuentas por cobrar...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              ¡Al día! No hay cuentas pendientes de pago.
            </p>
            <p className="text-xs text-slate-400">
              Todas las ventas activas están totalmente cobradas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Fecha Venta</th>
                  <th className="px-5 py-3">Vencimiento Crédito</th>
                  <th className="px-5 py-3 text-right">Total Venta</th>
                  <th className="px-5 py-3 text-right">Abonado</th>
                  <th className="px-5 py-3 text-right">Saldo Pendiente</th>
                  <th className="px-5 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {filteredSales.map((sale) => {
                  const pending = Number(sale.total) - Number(sale.paid);
                  const isOverdue =
                    sale.dueAt && sale.dueAt.slice(0, 10) < todayPeru;

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {sale.customer?.name}
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                          {sale.customer?.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {sale.customer.phone}
                            </span>
                          )}
                          {sale.customer?.document && (
                            <span>Doc: {sale.customer.document}</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(sale.createdAt).toLocaleDateString("es-PE", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {sale.dueAt ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isOverdue
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {new Date(sale.dueAt).toLocaleDateString("es-PE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                            {isOverdue && " (Vencido)"}
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin plazo fijo</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right font-semibold text-slate-600 whitespace-nowrap">
                        S/ {Number(sale.total).toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        S/ {Number(sale.paid).toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 text-right font-black text-amber-600 text-sm whitespace-nowrap">
                        S/ {pending.toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setPaySale(sale);
                            setPayAmount(pending.toFixed(2));
                          }}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold shadow-sm transition"
                        >
                          + Cobrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK PAYMENT MODAL */}
      {paySale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Abonar a {paySale.customer?.name}
            </h4>
            <p className="text-slate-500 text-xs">
              Deuda pendiente total: S/{" "}
              {(Number(paySale.total) - Number(paySale.paid)).toFixed(2)}
            </p>

            <form onSubmit={handleAddPayment} className="space-y-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Monto a Pagar (S/) *
                </label>
                <input
                  type="text"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Método de Pago
                </label>
                <select
                  value={payMethod}
                  onChange={(e) =>
                    setPayMethod(
                      e.target.value as "CASH" | "TRANSFER" | "YAPE" | "PLIN",
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800"
                >
                  <option value="CASH">Efectivo (CASH)</option>
                  <option value="YAPE">Yape</option>
                  <option value="PLIN">Plin</option>
                  <option value="TRANSFER">Transferencia Bancaria</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaySale(null)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingPayment ? "Registrando..." : "Confirmar Cobro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

