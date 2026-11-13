import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  FileX,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { ModuleStats } from "../../components/ModuleStats";
import { Customer, Product, Sale } from "../../types";

interface SalesTabProps {
  initialOpenNewSale?: boolean;
  onClearInitialOpenNewSale?: () => void;
}

export const SalesTab: React.FC<SalesTabProps> = ({
  initialOpenNewSale,
  onClearInitialOpenNewSale,
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [billingReady, setBillingReady] = useState(false);
  useEffect(() => { void api.getBillingConfig().then((value) => setBillingReady(value.configured)).catch(() => setBillingReady(false)); }, []);

  // Filters
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // New Sale Modal
  const [showNewModal, setShowNewModal] = useState(
    Boolean(initialOpenNewSale),
  );
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [saleItems, setSaleItems] = useState<
    Array<{ productId: string; quantity: number; unitPrice: string }>
  >([]);
  const [saleDueAt, setSaleDueAt] = useState("");
  const [submittingSale, setSubmittingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Quick Customer Creation in Sale Modal
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustDoc, setNewCustDoc] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  // Payment Modal in Sale Detail
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<
    "CASH" | "TRANSFER" | "YAPE" | "PLIN"
  >("CASH");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Cancel Modal in Sale Detail
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returnMethod, setReturnMethod] = useState<"CASH" | "TRANSFER" | "YAPE" | "PLIN">("CASH");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // SUNAT Invoice Modal in Sale Detail
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceType, setInvoiceType] = useState<"BOLETA" | "FACTURA">("BOLETA");
  const [invoiceIgvType, setInvoiceIgvType] = useState<
    "GRAVADO" | "EXONERADO" | "INAFECTO"
  >("GRAVADO");
  const [invoiceDocType, setInvoiceDocType] = useState<"6" | "1" | "-">("-");
  const [invoiceDoc, setInvoiceDoc] = useState("");
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceAddress, setInvoiceAddress] = useState("");
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salesData, prodData, custList] = await Promise.all([
        api.getSales({
          take: 50,
          status: filterStatus !== "ALL" ? filterStatus : undefined,
          customerId: filterCustomer || undefined,
        }),
        api.getProducts({ take: 100 }),
        api.getCustomers({ take: 100 }),
      ]);
      setSales(salesData);
      setProducts(prodData.filter((p) => p.active));
      setCustomers(custList);
    } catch (err) {
      console.error("Error al cargar ventas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [filterStatus, filterCustomer]);

  useEffect(() => {
    if (initialOpenNewSale) {
      setShowNewModal(true);
      onClearInitialOpenNewSale?.();
    }
  }, [initialOpenNewSale]);

  const addSaleItem = () => {
    const firstProd = products[0];
    if (!firstProd) return;
    setSaleItems((prev) => [
      ...prev,
      {
        productId: firstProd.id,
        quantity: 1,
        unitPrice: String(firstProd.price),
      },
    ]);
  };

  const updateSaleItem = (
    index: number,
    field: "productId" | "quantity" | "unitPrice",
    val: string | number,
  ) => {
    setSaleItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "productId") {
          const p = products.find((prod) => prod.id === val);
          return {
            ...item,
            productId: String(val),
            unitPrice: p ? String(p.price) : item.unitPrice,
          };
        }
        return { ...item, [field]: val };
      }),
    );
  };

  const removeSaleItem = (index: number) => {
    setSaleItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    try {
      const cust = await api.createCustomer({
        name: newCustName.trim(),
        document: newCustDoc.trim() || undefined,
        phone: newCustPhone.trim() || undefined,
        address: newCustAddress.trim() || undefined,
      });
      setCustomers((prev) => [...prev, cust]);
      setSaleCustomerId(cust.id);
      setShowQuickCustomer(false);
      setNewCustName("");
      setNewCustDoc("");
      setNewCustPhone("");
      setNewCustAddress("");
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Error al crear cliente rápido",
      );
    }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError(null);
    if (!saleCustomerId) {
      setSaleError("Selecciona un cliente.");
      return;
    }
    if (saleItems.length === 0) {
      setSaleError("Agrega al menos un producto a la venta.");
      return;
    }

    setSubmittingSale(true);
    try {
      const newSale = await api.createSale({
        customerId: saleCustomerId,
        items: saleItems.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice).toFixed(2),
        })),
        dueAt: saleDueAt ? new Date(saleDueAt).toISOString() : undefined,
      });
      setShowNewModal(false);
      setSaleItems([]);
      setSaleCustomerId("");
      setSaleDueAt("");
      await loadData();
      setSelectedSale(await api.getSaleById(newSale.id));
    } catch (err) {
      setSaleError(
        err instanceof Error ? err.message : "Error al registrar la venta",
      );
    } finally {
      setSubmittingSale(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale || !payAmount) return;
    setSubmittingPayment(true);
    try {
      await api.addPayment(selectedSale.id, {
        amount: Number(payAmount).toFixed(2),
        method: payMethod,
      });
      setShowPaymentModal(false);
      setPayAmount("");
      const refreshed = await api.getSaleById(selectedSale.id);
      setSelectedSale(refreshed);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar abono");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeliveryChange = async (
    status: "PENDING" | "DISPATCHED" | "DELIVERED" | "PICKED_UP",
  ) => {
    if (!selectedSale) return;
    try {
      const updated = await api.updateDelivery(selectedSale.id, status);
      setSelectedSale(updated);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cambiar entrega");
    }
  };

  const handleCancelSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale || !cancelReason.trim()) return;
    setSubmittingCancel(true);
    try {
      const cancelled = await api.cancelSale(
        selectedSale.id,
        cancelReason.trim(),
      );
      setShowCancelModal(false);
      setCancelReason("");
      setSelectedSale(cancelled);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al anular venta");
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handleReturnSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;
    const items = Object.entries(returnQty).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity }));
    if (!items.length) { alert("Selecciona al menos una caja máster o display para devolver"); return; }
    const credit = selectedSale.items.reduce((sum, item) => sum + Number(item.unitPrice) * (returnQty[item.productId] ?? 0), 0);
    const refund = Math.max(0, Number(selectedSale.paid) - Math.max(0, Number(selectedSale.total) - credit));
    setSubmittingReturn(true);
    try {
      await api.returnSale(selectedSale.id, { reason: returnReason.trim(), items, ...(refund > 0 ? { refundMethod: returnMethod } : {}) });
      const refreshed = await api.getSaleById(selectedSale.id);
      setSelectedSale(refreshed);
      setShowReturnModal(false);
      setReturnQty({}); setReturnReason("");
      await loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "No se pudo registrar la devolución"); }
    finally { setSubmittingReturn(false); }
  };

  const handleOpenInvoiceModal = () => {
    if (!selectedSale) return;
    const cust = selectedSale.customer;
    const doc = cust?.document || "";
    const isRuc = /^\d{11}$/.test(doc);
    const isDni = /^\d{8}$/.test(doc);

    setInvoiceType(isRuc ? "FACTURA" : "BOLETA");
    setInvoiceDocType(isRuc ? "6" : isDni ? "1" : "-");
    setInvoiceDoc(doc);
    setInvoiceName(cust?.name || "");
    setInvoiceAddress(cust?.address || "");
    setShowInvoiceModal(true);
  };

  const handleIssueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;
    setSubmittingInvoice(true);
    try {
      await api.issueSaleInvoice(selectedSale.id, {
        type: invoiceType,
        igvType: invoiceIgvType,
        customerDocumentType: invoiceDocType,
        customerDocument: invoiceDoc.trim() || undefined,
        customerName: invoiceName.trim() || undefined,
        customerAddress: invoiceAddress.trim() || undefined,
      });
      setShowInvoiceModal(false);
      const refreshed = await api.getSaleById(selectedSale.id);
      setSelectedSale(refreshed);
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error al emitir comprobante",
      );
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const totalSaleDraft = saleItems.reduce(
    (sum, i) => sum + Number(i.unitPrice || 0) * Number(i.quantity || 0),
    0,
  );
  const returnCredit = selectedSale?.items.reduce((sum, item) => sum + Number(item.unitPrice) * (returnQty[item.productId] ?? 0), 0) ?? 0;
  const returnRefund = selectedSale ? Math.max(0, Number(selectedSale.paid) - Math.max(0, Number(selectedSale.total) - returnCredit)) : 0;

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <ShoppingBag className="h-7 w-7 shrink-0 text-[#8b4d31]" aria-hidden="true" />
            Registro y Control de Ventas
          </h2>
          <p className="text-xs text-slate-500">
            Ventas mayoristas por cajas máster y displays con precios acordados
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
            onClick={() => {
              setShowNewModal(true);
              if (saleItems.length === 0) addSaleItem();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md shadow-brand-600/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Venta</span>
          </button>
        </div>
      </div>

      <ModuleStats loading={loading} items={[
        { label: "Ventas en la lista", value: sales.length, icon: ShoppingBag, detail: "Según los filtros aplicados", tone: "navy" },
        { label: "Por entregar", value: sales.filter(s => s.status === "ACTIVE" && s.delivery === "PENDING").length, icon: Truck, detail: "Pedidos visibles pendientes" },
        { label: "Saldo por cobrar", value: `S/ ${sales.filter(s => s.status === "ACTIVE").reduce((sum, s) => sum + Math.max(0, Number(s.total) - Number(s.paid)), 0).toFixed(2)}`, icon: DollarSign, detail: "Solo ventas de esta lista", tone: "amber" },
      ]} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Estado:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none"
          >
            <option value="ALL">Todas las ventas</option>
            <option value="ACTIVE">Solo Activas</option>
            <option value="CANCELLED">Solo Anuladas</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Cliente:</span>
          <select
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none max-w-xs"
          >
            <option value="">Todos los clientes</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.document ? `(${c.document})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && sales.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            Cargando ventas...
          </div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm">No se encontraron ventas registradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Productos</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Cobrado</th>
                  <th className="px-5 py-3">Entrega</th>
                  <th className="px-5 py-3">SUNAT</th>
                  <th className="px-5 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sales.map((sale) => {
                  const pendingAmount = Number(sale.total) - Number(sale.paid);
                  const isPaid = pendingAmount <= 0;
                  const latestInvoice = sale.invoices?.[0];

                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-slate-50/80 transition cursor-pointer ${
                        sale.status === "CANCELLED"
                          ? "bg-slate-50/50 opacity-60"
                          : ""
                      }`}
                      onClick={() => setSelectedSale(sale)}
                    >
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(sale.createdAt).toLocaleDateString("es-PE", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {sale.customer?.name ?? "Cliente"}
                        </div>
                        {sale.customer?.phone && (
                          <span className="text-xs text-slate-400 block font-normal">
                            {sale.customer.phone}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                        {sale.items
                          ?.map(
                            (i) =>
                              `${i.quantity}x ${
                                i.product?.name ?? "Prod"
                              }`,
                          )
                          .join(", ") || "-"}
                      </td>

                      <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                        S/ {Number(sale.total).toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                            <Check className="h-3 w-3" /> Pagado
                          </span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                            Debe S/ {pendingAmount.toFixed(2)}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold ${
                            sale.delivery === "DELIVERED" ||
                            sale.delivery === "PICKED_UP"
                              ? "bg-emerald-50 text-emerald-700"
                              : sale.delivery === "DISPATCHED"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {sale.delivery === "DELIVERED"
                            ? "Entregado"
                            : sale.delivery === "PICKED_UP"
                              ? "Recogido"
                              : sale.delivery === "DISPATCHED"
                                ? "Despachado"
                                : "Pendiente"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-xs">
                        {sale.status === "CANCELLED" ? (
                          <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded font-bold">
                            Anulada
                          </span>
                        ) : latestInvoice ? (
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              latestInvoice.sunatAccepted
                                ? "bg-emerald-50 text-emerald-700"
                                : latestInvoice.status === "REJECTED"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {latestInvoice.type === "FACTURA" ? "FAC" : "BOL"}{" "}
                            {latestInvoice.serie}-{latestInvoice.number}
                          </span>
                        ) : (
                          <span className="text-slate-400">Sin emitir</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap text-xs">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(sale);
                          }}
                          className="px-2.5 py-1 text-brand-600 hover:bg-brand-50 rounded-lg font-bold"
                        >
                          Ver Detalle →
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

      {/* MODAL: NUEVA VENTA */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                Registrar Nueva Venta Mayorista
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {saleError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{saleError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSale} className="space-y-6">
              {/* Cliente Selector */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">
                    Cliente *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickCustomer(!showQuickCustomer)}
                    className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
                  >
                    {showQuickCustomer
                      ? "- Ocultar registro rápido"
                      : "+ Crear nuevo cliente"}
                  </button>
                </div>

                {!showQuickCustomer ? (
                  <select
                    required
                    value={saleCustomerId}
                    onChange={(e) => setSaleCustomerId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecciona un cliente...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.document ? `(Doc: ${c.document})` : ""}{" "}
                        {c.phone ? `- Tel: ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                    <span className="text-xs font-bold text-amber-900 block">
                      Nuevo Cliente Rápido
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <input
                        type="text"
                        placeholder="Nombre o Razón Social *"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg p-2"
                      />
                      <input
                        type="text"
                        placeholder="RUC o DNI (opcional)"
                        value={newCustDoc}
                        onChange={(e) => setNewCustDoc(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg p-2"
                      />
                      <input
                        type="text"
                        placeholder="Teléfono / WhatsApp"
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg p-2"
                      />
                      <input
                        type="text"
                        placeholder="Dirección de entrega"
                        value={newCustAddress}
                        onChange={(e) => setNewCustAddress(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg p-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateQuickCustomer}
                      className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700"
                    >
                      Guardar y Seleccionar
                    </button>
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700">
                    Productos del Pedido (Mezcla libre)
                  </label>
                  <button
                    type="button"
                    onClick={addSaleItem}
                    className="text-xs text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agregar Producto
                  </button>
                </div>

                <div className="space-y-2.5">
                  {saleItems.map((item, idx) => {
                    const prod = products.find((p) => p.id === item.productId);
                    const lineSubtotal =
                      Number(item.unitPrice || 0) * Number(item.quantity || 0);

                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        {/* Product Picker */}
                        <div className="flex-1 w-full sm:w-auto">
                          <select
                            value={item.productId}
                            onChange={(e) =>
                              updateSaleItem(idx, "productId", e.target.value)
                            }
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 font-medium"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.presentation}) - Stock: {p.stock}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="w-24">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5 sm:hidden">
                            Cantidad (máster o displays)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={prod ? Math.max(1, prod.stock) : 1000}
                            value={item.quantity}
                            onChange={(e) =>
                              updateSaleItem(
                                idx,
                                "quantity",
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-center font-bold"
                          />
                        </div>

                        {/* Negotiated Unit Price */}
                        <div className="w-28">
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5 sm:hidden">
                            Precio acordado
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-slate-400">
                              S/
                            </span>
                            <input
                              type="text"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateSaleItem(idx, "unitPrice", e.target.value)
                              }
                              className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-2 text-right font-bold"
                              title="Precio pactado por caja máster o display para este cliente"
                            />
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div className="w-28 text-right font-black text-slate-900 pr-2">
                          S/ {lineSubtotal.toFixed(2)}
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeSaleItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1.5 self-end sm:self-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total and Due Date */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha límite para crédito (opcional)
                  </label>
                  <input
                    type="date"
                    value={saleDueAt}
                    onChange={(e) => setSaleDueAt(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium"
                  />
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500 block font-medium">
                    Total a Cobrar:
                  </span>
                  <span className="text-3xl font-black text-slate-900">
                    S/ {totalSaleDraft.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingSale}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-brand-600/20"
                >
                  {submittingSale ? "Registrando..." : "Confirmar Venta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETALLE DE VENTA */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono text-slate-400 block">
                  ID: {selectedSale.id}
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  Venta a {selectedSale.customer?.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sale Status Banner */}
            {selectedSale.status === "CANCELLED" ? (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                <Ban className="h-4 w-4 shrink-0 text-red-600" />
                <span>
                  <strong>Venta Anulada:</strong>{" "}
                  {selectedSale.cancelReason || "Sin motivo especificado"}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Total</span>
                  <span className="text-base font-black text-slate-900">
                    S/ {Number(selectedSale.total).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-emerald-600 block">Cobrado</span>
                  <span className="text-base font-black text-emerald-700">
                    S/ {Number(selectedSale.paid).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <span className="text-amber-600 block">Saldo Pendiente</span>
                  <span className="text-base font-black text-amber-700">
                    S/{" "}
                    {(
                      Number(selectedSale.total) - Number(selectedSale.paid)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <span className="text-blue-600 block">Entrega</span>
                  <select
                    value={selectedSale.delivery}
                    onChange={(e) =>
                      void handleDeliveryChange(
                        e.target.value as
                          | "PENDING"
                          | "DISPATCHED"
                          | "DELIVERED"
                          | "PICKED_UP",
                      )
                    }
                    className="mt-1 bg-transparent font-bold text-blue-900 text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="PENDING">Pendiente</option>
                    <option value="DISPATCHED">Despachado</option>
                    <option value="DELIVERED">Entregado</option>
                    <option value="PICKED_UP">Recogido</option>
                  </select>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Productos Comprados
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-500 font-semibold">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5 text-center">Cantidad</th>
                      <th className="p-2.5 text-right">Precio Pactado</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSale.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2.5 font-medium text-slate-900">
                          {item.product?.name ?? "Producto"}{" "}
                          <span className="text-slate-400 font-normal">
                            ({item.product?.presentation})
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-bold">
                          {item.quantity}
                        </td>
                        <td className="p-2.5 text-right">
                          S/ {Number(item.unitPrice).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900">
                          S/{" "}
                          {(Number(item.unitPrice) * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments History */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Historial de Pagos y Abonos
                </h4>
                {selectedSale.status === "ACTIVE" &&
                  Number(selectedSale.paid) < Number(selectedSale.total) && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Registrar Abono
                    </button>
                  )}
              </div>

              {selectedSale.payments?.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  Aún no se han registrado abonos para esta venta.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs divide-y divide-slate-100">
                  {selectedSale.payments?.map((pay) => (
                    <div
                      key={pay.id}
                      className="p-2.5 flex justify-between items-center bg-white"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          S/ {Number(pay.amount).toFixed(2)}
                        </span>
                        <span className="text-slate-400 ml-2">
                          Método: <strong>{pay.method}</strong>
                        </span>
                      </div>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(pay.createdAt).toLocaleDateString("es-PE", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SUNAT Section in Sale */}
            {!!selectedSale.returns?.length && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs"><h4 className="font-bold text-amber-900">Devoluciones registradas</h4>{selectedSale.returns.map((item) => <p key={item.id} className="mt-2 text-amber-900">{new Date(item.createdAt).toLocaleDateString("es-PE")}: S/ {Number(item.creditAmount).toFixed(2)} descontados · S/ {Number(item.refundAmount).toFixed(2)} devueltos · {item.reason}</p>)}</div>}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-brand-600" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Facturación Electrónica SUNAT
                  </span>
                </div>

                {billingReady && selectedSale.status === "ACTIVE" &&
                  (!selectedSale.invoices ||
                    selectedSale.invoices.length === 0) && (
                    <button
                      onClick={handleOpenInvoiceModal}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-1 shadow-sm"
                    >
                      <Send className="h-3 w-3" />
                      Emitir Boleta / Factura
                    </button>
                  )}
              </div>

              {selectedSale.invoices && selectedSale.invoices.length > 0 ? (
                <div className="space-y-2">
                  {selectedSale.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          {inv.type} {inv.serie}-{inv.number}
                        </span>
                        <span
                          className={`ml-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.sunatAccepted
                              ? "bg-emerald-50 text-emerald-700"
                              : inv.status === "REJECTED"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {inv.sunatAccepted
                            ? "Aceptado por SUNAT"
                            : inv.status}
                        </span>
                        {inv.sunatDescription && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {inv.sunatDescription}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold"
                          >
                            PDF
                          </a>
                        )}
                        {inv.xmlUrl && (
                          <a
                            href={inv.xmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold"
                          >
                            XML
                          </a>
                        )}
                        {inv.cdrUrl && (
                          <a
                            href={inv.cdrUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-semibold"
                          >
                            CDR
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {billingReady ? "Esta venta no cuenta con comprobante electrónico enviado todavía." : "Emisión electrónica desactivada hasta configurar el proveedor de facturación."}
                </p>
              )}
            </div>

            {/* Actions Bar Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
              {selectedSale.status === "ACTIVE" ? (
                <div className="flex flex-wrap items-center gap-4">
                  <button onClick={() => { setReturnQty({}); setReturnReason(""); setReturnMethod("CASH"); setShowReturnModal(true); }} className="font-semibold text-[#8b4d31]">Registrar devolución</button>
                  {Number(selectedSale.paid) === 0 && !selectedSale.returns?.length && <button onClick={() => setShowCancelModal(true)} className="text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"><Ban className="h-3.5 w-3.5" /><span>Anular Venta</span></button>}
                </div>
              ) : (
                <span className="text-slate-400">Venta cerrada</span>
              )}

              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showReturnModal && selectedSale && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><h4 className="text-lg font-bold">Registrar devolución de cajas</h4><p className="mt-1 text-sm text-slate-600">Las cajas devueltas regresarán al stock. Registra solo las que estén aptas para vender.</p><form onSubmit={handleReturnSale} className="mt-4 space-y-4 text-sm"><div className="space-y-2">{selectedSale.items.map(item => { const available = item.quantity - (selectedSale.returns ?? []).reduce((sum, record) => sum + (record.items.find(i => i.productId === item.productId)?.quantity ?? 0), 0); return <label key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span className="font-medium">{item.product?.name ?? "Producto"} <small className="block text-slate-500">Máximo: {available} cajas de esta presentación</small></span><input type="number" min="0" max={available} value={returnQty[item.productId] ?? 0} onChange={(e) => setReturnQty((rows) => ({ ...rows, [item.productId]: Math.min(available, Math.max(0, Number(e.target.value) || 0)) }))} className="w-20 rounded-lg border border-slate-200 p-2 text-center" /></label>; })}</div><label className="block font-medium">Motivo *<textarea required minLength={3} maxLength={250} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></label><div className="rounded-xl bg-amber-50 p-3 text-sm">Descuento de la venta: <strong>S/ {returnCredit.toFixed(2)}</strong><br />Dinero a devolver al cliente: <strong>S/ {returnRefund.toFixed(2)}</strong></div>{returnRefund > 0 && <label className="block font-medium">¿Cómo se devolvió el dinero?<select value={returnMethod} onChange={(e) => setReturnMethod(e.target.value as typeof returnMethod)} className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="YAPE">Yape</option><option value="PLIN">Plin</option></select></label>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setShowReturnModal(false)} className="rounded-lg border border-slate-200 px-4 py-2">Cancelar</button><button disabled={submittingReturn} className="rounded-lg bg-[#8b4d31] px-4 py-2 font-bold text-white disabled:opacity-50">{submittingReturn ? "Guardando..." : "Confirmar devolución"}</button></div></form></div></div>}

      {/* SUB-MODAL: REGISTRAR ABONO */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-slate-900 text-base">
              Registrar Cobro / Abono
            </h4>
            <form onSubmit={handleAddPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Monto a pagar (S/)
                </label>
                <input
                  type="text"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={(
                    Number(selectedSale.total) - Number(selectedSale.paid)
                  ).toFixed(2)}
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
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingPayment ? "Guardando..." : "Confirmar Abono"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: ANULAR VENTA */}
      {showCancelModal && selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-red-600 text-base flex items-center gap-2">
              <Ban className="h-5 w-5" /> Anular Venta
            </h4>
            <p className="text-xs text-slate-500">
              Al anular esta venta, se restituirá el stock a los productos y se
              eliminará la deuda de cuentas por cobrar.
            </p>
            <form onSubmit={handleCancelSale} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Motivo de anulación *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej: Pedido cancelado por el cliente antes del despacho"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={submittingCancel}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingCancel ? "Anulando..." : "Confirmar Anulación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: EMITIR COMPROBANTE SUNAT */}
      {showInvoiceModal && selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Emitir Comprobante a SUNAT
            </h4>
            <form onSubmit={handleIssueInvoice} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tipo Comprobante
                  </label>
                  <select
                    value={invoiceType}
                    onChange={(e) =>
                      setInvoiceType(e.target.value as "BOLETA" | "FACTURA")
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                  >
                    <option value="BOLETA">Boleta de Venta</option>
                    <option value="FACTURA">Factura (con RUC)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tratamiento IGV
                  </label>
                  <select
                    value={invoiceIgvType}
                    onChange={(e) =>
                      setInvoiceIgvType(
                        e.target.value as "GRAVADO" | "EXONERADO" | "INAFECTO",
                      )
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                  >
                    <option value="GRAVADO">Gravado (18% incluido)</option>
                    <option value="EXONERADO">Exonerado (0%)</option>
                    <option value="INAFECTO">Inafecto (0%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {invoiceType === "FACTURA"
                    ? "RUC del Cliente (11 dígitos) *"
                    : "DNI o RUC (opcional si es menor a S/ 700)"}
                </label>
                <input
                  type="text"
                  required={invoiceType === "FACTURA"}
                  value={invoiceDoc}
                  onChange={(e) => setInvoiceDoc(e.target.value)}
                  placeholder={invoiceType === "FACTURA" ? "20123456789" : "12345678"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Razón Social / Nombre en Comprobante
                </label>
                <input
                  type="text"
                  value={invoiceName}
                  onChange={(e) => setInvoiceName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Dirección Fiscal
                </label>
                <input
                  type="text"
                  value={invoiceAddress}
                  onChange={(e) => setInvoiceAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingInvoice}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingInvoice ? "Enviando..." : "Emitir Comprobante"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
