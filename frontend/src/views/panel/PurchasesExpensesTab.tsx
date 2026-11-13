import React, { useEffect, useState } from "react";
import {
  DollarSign,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { ModuleStats } from "../../components/ModuleStats";
import { Product, Purchase, Supplier } from "../../types";

export const PurchasesExpensesTab: React.FC = () => {
  const [subTab, setSubTab] = useState<"purchases" | "expenses" | "cash" | "cards">(
    "purchases",
  );
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<
    Array<{ id: string; description: string; amount: string; createdAt: string }>
  >([]);
  const [cashSummary, setCashSummary] = useState<{
    collections: string;
    cardPayments: string;
    expenses: string;
    scope: string;
  } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingInstallments, setPendingInstallments] = useState<Awaited<ReturnType<typeof api.getPendingPurchaseInstallments>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // New Purchase Modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purSupplierId, setPurSupplierId] = useState("");
  const [purDate, setPurDate] = useState(() => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [purItems, setPurItems] = useState<
    Array<{ productId: string; quantity: number; unitCost: string }>
  >([]);
  const [submittingPur, setSubmittingPur] = useState(false);
  const [purPaymentMethod, setPurPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
  const [purCardName, setPurCardName] = useState("");
  const [purInstallments, setPurInstallments] = useState<Array<{ amount: string; dueAt: string }>>([]);
  const [payingInstallment, setPayingInstallment] = useState("");

  // New Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expDescription, setExpDescription] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [submittingExp, setSubmittingExp] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const [purList, expList, cash, suppList, prodList, dues] = await Promise.all([
        api.getPurchases({ take: 50 }),
        api.getExpenses({ take: 50 }),
        api.getCashSummary(),
        api.getSuppliers({ take: 100 }),
        api.getProducts({ take: 100 }),
        api.getPendingPurchaseInstallments(),
      ]);
      setPurchases(purList);
      setExpenses(expList);
      setCashSummary(cash);
      setSuppliers(suppList);
      setProducts(prodList);
      setPendingInstallments(dues);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudieron cargar compras y gastos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const addPurchaseItem = () => {
    const firstProd = products[0];
    if (!firstProd) return;
    setPurItems((prev) => [
      ...prev,
      {
        productId: firstProd.id,
        quantity: 1,
        unitCost: String(firstProd.cost),
      },
    ]);
  };

  const updatePurchaseItem = (
    index: number,
    field: "productId" | "quantity" | "unitCost",
    val: string | number,
  ) => {
    setPurItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "productId") {
          const p = products.find((prod) => prod.id === val);
          return {
            ...item,
            productId: String(val),
            unitCost: p ? String(p.cost) : item.unitCost,
          };
        }
        return { ...item, [field]: val };
      }),
    );
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purSupplierId || purItems.length === 0) return;
    setSubmittingPur(true);
    try {
      await api.createPurchase({
        supplierId: purSupplierId,
        purchasedAt: purDate,
        paymentMethod: purPaymentMethod,
        ...(purPaymentMethod === "CARD" ? { cardName: purCardName.trim(), installments: purInstallments.map(i => ({ amount: Number(i.amount).toFixed(2), dueAt: i.dueAt })) } : {}),
        items: purItems.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost).toFixed(2),
        })),
      });
      setShowPurchaseModal(false);
      setPurItems([]);
      setPurPaymentMethod("CASH");
      setPurCardName("");
      setPurInstallments([]);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar compra");
    } finally {
      setSubmittingPur(false);
    }
  };
  const handlePayInstallment = async (purchaseId: string, installmentId: string) => {
    setPayingInstallment(installmentId);
    try {
      await api.payPurchaseInstallment(purchaseId, installmentId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo marcar la cuota como pagada");
    } finally { setPayingInstallment(""); }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDescription.trim() || !expAmount) return;
    setSubmittingExp(true);
    try {
      await api.createExpense({
        description: expDescription.trim(),
        amount: Number(expAmount).toFixed(2),
      });
      setShowExpenseModal(false);
      setExpDescription("");
      setExpAmount("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar gasto");
    } finally {
      setSubmittingExp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <Receipt className="h-7 w-7 shrink-0 text-[#8b4d31]" aria-hidden="true" />
            Compras, Gastos y Resumen de Caja
          </h2>
          <p className="text-xs text-slate-500">
            Ingreso de mercadería de proveedores y gastos de operación
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadData()}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Recargar"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
          >
            + Registrar Gasto
          </button>

          <button
            onClick={() => {
              setShowPurchaseModal(true);
              if (purItems.length === 0) addPurchaseItem();
            }}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20"
          >
            + Registrar Compra
          </button>
        </div>
      </div>

      {/* Subtabs Selector */}
      {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>}
      <ModuleStats loading={loading} items={[
        { label: "Compras cargadas", value: purchases.length, icon: ShoppingBag, detail: "Registros visibles", tone: "navy" },
        { label: "Gastos cargados", value: expenses.length, icon: Receipt, detail: "Registros visibles", tone: "amber" },
        { label: "Proveedores cargados", value: suppliers.length, icon: Truck, detail: "Para registrar compras" },
        { label: "Cuotas pendientes", value: pendingInstallments.length, icon: DollarSign, detail: "Compras con tarjeta", tone: "amber" },
      ]} />
      <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold w-fit">
        <button
          onClick={() => setSubTab("purchases")}
          className={`px-4 py-1.5 rounded-lg transition ${
            subTab === "purchases"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Compras a Proveedores ({purchases.length})
        </button>
        <button
          onClick={() => setSubTab("expenses")}
          className={`px-4 py-1.5 rounded-lg transition ${
            subTab === "expenses"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Gastos Operativos ({expenses.length})
        </button>
        <button
          onClick={() => setSubTab("cash")}
          className={`px-4 py-1.5 rounded-lg transition ${
            subTab === "cash"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Resumen de Caja
        </button>
        <button onClick={() => setSubTab("cards")} className={`px-4 py-1.5 rounded-lg transition ${subTab === "cards" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>Tarjetas ({pendingInstallments.length})</button>
      </div>

      {subTab === "cards" && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Vencimiento</th><th className="p-4">Tarjeta</th><th className="p-4">Proveedor</th><th className="p-4">Cuota</th><th className="p-4 text-right">Monto</th><th className="p-4">Acción</th></tr></thead><tbody>{pendingInstallments.map((due) => <tr key={due.id} className="border-t border-slate-100"><td className="p-4 font-semibold">{new Date(due.dueAt).toLocaleDateString("es-PE", { timeZone: "UTC" })}{due.dueAt.slice(0, 10) < new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10) && <span className="ml-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">Vencida</span>}</td><td className="p-4">{due.purchase.cardName}</td><td className="p-4">{due.purchase.supplier.name}</td><td className="p-4">#{due.number}</td><td className="p-4 text-right font-bold">S/ {Number(due.amount).toFixed(2)}</td><td className="p-4"><button disabled={payingInstallment === due.id} onClick={() => void handlePayInstallment(due.purchaseId, due.id)} className="rounded-lg border border-[#d8bda9] px-3 py-2 font-semibold text-[#8b4d31] disabled:opacity-50">Marcar pagada</button></td></tr>)}</tbody></table>{!pendingInstallments.length && <p className="p-6 text-center text-slate-500">No hay cuotas pendientes.</p>}</div>}

      {/* SUBTAB 1: PURCHASES */}
      {subTab === "purchases" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Proveedor</th>
                  <th className="px-5 py-3">Ítems Ingresados</th>
                  <th className="px-5 py-3 text-right">Total Compra</th>
                  <th className="px-5 py-3">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {purchases.map((pur) => (
                  <tr key={pur.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(pur.purchasedAt ?? pur.createdAt).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {pur.supplier?.name || "Proveedor"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {pur.items
                        ?.map(
                          (i) =>
                            `${i.quantity}x ${i.product?.name ?? "Prod"} (S/ ${Number(i.unitCost).toFixed(2)})`,
                        )
                        .join(", ")}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                      S/ {Number(pur.total).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 min-w-48">
                      {pur.paymentMethod === "CARD" ? <details><summary className="cursor-pointer font-semibold text-[#8b4d31]">{pur.cardName} · {pur.installments?.filter(i => !i.paidAt).length ?? 0} cuotas pendientes</summary><div className="mt-2 space-y-2">{pur.installments?.map(i => <div key={i.id} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2"><span>#{i.number} · S/ {Number(i.amount).toFixed(2)} · vence {new Date(i.dueAt).toLocaleDateString("es-PE", { timeZone: "UTC" })}</span>{i.paidAt ? <span className="font-semibold text-emerald-700">Pagada {new Date(i.paidAt).toLocaleDateString("es-PE")}</span> : <button disabled={payingInstallment === i.id} onClick={() => void handlePayInstallment(pur.id, i.id)} className="rounded-lg border border-[#d8bda9] px-2 py-1 font-semibold text-[#8b4d31] disabled:opacity-50">Marcar pagada</button>}</div>)}</div></details> : pur.paymentMethod === "TRANSFER" ? "Transferencia" : "Contado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: EXPENSES */}
      {subTab === "expenses" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Descripción del Gasto</th>
                  <th className="px-5 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(exp.createdAt).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {exp.description}
                    </td>
                    <td className="px-5 py-3.5 text-right font-black text-red-600 text-sm whitespace-nowrap">
                      - S/ {Number(exp.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: CASH SUMMARY */}
      {subTab === "cash" && cashSummary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="silva-summary-card bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cobros netos de devoluciones
            </span>
            <div className="text-2xl font-black text-emerald-600 flex items-center gap-1">
              <TrendingUp className="h-6 w-6" /> S/ {cashSummary.collections}
            </div>
            <p className="text-xs text-slate-400">
              Cobros recibidos menos dinero devuelto a clientes.
            </p>
          </div>

          <div className="silva-summary-card bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Gastos Registrados
            </span>
            <div className="text-2xl font-black text-red-600 flex items-center gap-1">
              <TrendingDown className="h-6 w-6" /> S/ {cashSummary.expenses}
            </div>
            <p className="text-xs text-slate-400">
              Gastos menores y operativos registrados en el sistema.
            </p>
          </div>

          <div className="silva-summary-card bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cuotas de tarjeta pagadas
            </span>
            <div className="text-2xl font-black text-amber-700">S/ {cashSummary.cardPayments}</div>
            <p className="text-xs text-slate-400">Cuotas marcadas como pagadas en compras.</p>
          </div>

          <div className="silva-summary-card bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Flujo registrado
            </span>
            <div className="text-2xl font-black text-slate-900">
              S/{" "}
              {(
                Number(cashSummary.collections) - Number(cashSummary.expenses) - Number(cashSummary.cardPayments)
              ).toFixed(2)}
            </div>
            <p className="text-xs text-slate-400">
              {cashSummary.scope}
            </p>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA COMPRA */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-base">
                Registrar Compra de Mercadería
              </h4>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4">
              <label className="block font-semibold text-slate-700">Fecha de compra *<input required type="date" value={purDate} onChange={(e) => setPurDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2" /></label>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Proveedor *
                </label>
                <select
                  required
                  value={purSupplierId}
                  onChange={(e) => setPurSupplierId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                >
                  <option value="">Selecciona un proveedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.document ? `(${s.document})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-slate-700">
                    Productos Comprados
                  </label>
                  <button
                    type="button"
                    onClick={addPurchaseItem}
                    className="text-brand-600 font-bold"
                  >
                    + Agregar Ítem
                  </button>
                </div>

                {purItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <select
                      value={item.productId}
                      onChange={(e) =>
                        updatePurchaseItem(idx, "productId", e.target.value)
                      }
                      className="w-full min-w-0 bg-white border border-slate-200 rounded p-1.5 font-medium sm:w-auto sm:flex-1"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.presentation})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Cantidad"
                      value={item.quantity}
                      onChange={(e) =>
                        updatePurchaseItem(
                          idx,
                          "quantity",
                          parseInt(e.target.value) || 1,
                        )
                      }
                      className="w-20 bg-white border border-slate-200 rounded p-1.5 text-center font-bold"
                    />

                    <div className="relative w-24">
                      <span className="absolute left-1.5 top-1.5 text-slate-400">
                        S/
                      </span>
                      <input
                        type="text"
                        placeholder="Costo"
                        value={item.unitCost}
                        onChange={(e) =>
                          updatePurchaseItem(idx, "unitCost", e.target.value)
                        }
                        className="w-full bg-white border border-slate-200 rounded pl-5 pr-1.5 py-1.5 text-right font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="font-semibold text-slate-700" htmlFor="purchase-payment-method">Forma de pago</label>
                  <select id="purchase-payment-method" value={purPaymentMethod} onChange={(e) => {
                    const method = e.target.value as "CASH" | "CARD" | "TRANSFER";
                    setPurPaymentMethod(method);
                    setPurInstallments(method === "CARD" ? [{ amount: purItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitCost), 0).toFixed(2), dueAt: "" }] : []);
                  }} className="rounded-lg border border-slate-200 bg-white p-2">
                    <option value="CASH">Contado</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta de crédito</option>
                  </select>
                </div>
                {purPaymentMethod === "CARD" && <>
                  <label className="block font-semibold text-slate-700">Nombre de la tarjeta<input required maxLength={60} value={purCardName} onChange={(e) => setPurCardName(e.target.value)} placeholder="Ej: Visa BCP" className="mt-1 block w-full rounded-lg border border-slate-200 bg-white p-2" /></label>
                  <div className="flex items-center justify-between"><span className="font-semibold text-slate-700">Cuotas y vencimientos</span><button type="button" onClick={() => setPurInstallments((rows) => [...rows, { amount: "", dueAt: "" }])} className="font-bold text-[#8b4d31]">+ Agregar cuota</button></div>
                  {purInstallments.map((installment, index) => <div key={index} className="flex items-center gap-2"><span className="w-7 font-bold">#{index + 1}</span><label className="flex-1">Monto S/<input required type="number" min="0.01" step="0.01" value={installment.amount} onChange={(e) => setPurInstallments((rows) => rows.map((row, i) => i === index ? { ...row, amount: e.target.value } : row))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label><label className="flex-1">Vence<input required type="date" value={installment.dueAt} onChange={(e) => setPurInstallments((rows) => rows.map((row, i) => i === index ? { ...row, dueAt: e.target.value } : row))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label>{purInstallments.length > 1 && <button type="button" onClick={() => setPurInstallments((rows) => rows.filter((_, i) => i !== index))} aria-label={`Quitar cuota ${index + 1}`} className="mt-4 rounded-lg p-1 text-red-600"><X className="h-4 w-4" /></button>}</div>)}
                  <p className="text-slate-600">Total de cuotas: S/ {purInstallments.reduce((sum, i) => sum + Number(i.amount || 0), 0).toFixed(2)} · Total compra: S/ {purItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitCost || 0), 0).toFixed(2)}</p>
                </>}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingPur}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingPur ? "Guardando..." : "Ingresar Compra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO GASTO */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Registrar Gasto Operativo
            </h4>
            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descripción del Gasto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Combustible motofurgón, cinta de embalaje..."
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Monto (S/) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="25.00"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-base text-red-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingExp}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingExp ? "Guardando..." : "Confirmar Gasto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

