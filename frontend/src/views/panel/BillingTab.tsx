import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { ModuleStats } from "../../components/ModuleStats";
import { Invoice, InvoiceType, SunatStatus } from "../../types";

export const BillingTab: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingReady, setBillingReady] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [sharePhone, setSharePhone] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [showDesign, setShowDesign] = useState(false);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Credit Note Modal
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditTarget, setCreditTarget] = useState<Invoice | null>(null);
  const [creditReason, setCreditReason] = useState("");
  const [creditCode, setCreditCode] = useState("01");
  const [creditCancelSale, setCreditCancelSale] = useState(true);
  const [submittingCredit, setSubmittingCredit] = useState(false);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoices({
        take: 100,
        type: filterType !== "ALL" ? filterType : undefined,
        status: filterStatus !== "ALL" ? filterStatus : undefined,
        q: search || undefined,
      });
      setInvoices(data);
    } catch (err) {
      console.error("Error al cargar comprobantes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInvoices();
  }, [filterType, filterStatus, search]);
  useEffect(() => { void api.getBillingConfig().then((value) => setBillingReady(value.configured)).catch(() => setBillingReady(false)); }, []);
  useEffect(() => { void api.getHealth().then(value => setEnvironment(value.environment)).catch(() => setEnvironment(null)); }, []);
  useEffect(() => { setSharePhone(""); setShareEmail(""); }, [selectedInvoice?.id]);

  const handleCheckConnection = async () => {
    setCheckingConnection(true);
    setConnectionResult(null);
    try {
      const result = await api.checkBillingConnection();
      setConnectionResult({
        ok: result.authenticated,
        message: result.authenticated
          ? "Nubefact respondió a la consulta. Verifica el modo de tu cuenta en Nubefact antes de emitir."
          : result.description || "Nubefact no confirmó las credenciales.",
      });
    } catch (err) {
      setConnectionResult({ ok: false, message: err instanceof Error ? err.message : "No se pudo comprobar la conexión." });
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const updated = await api.syncInvoice(id);
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updated);
      }
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Error al sincronizar con SUNAT/Nubefact",
      );
    } finally {
      setSyncingId(null);
    }
  };

  const handleIssueCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditTarget || !creditReason.trim()) return;
    setSubmittingCredit(true);
    try {
      await api.issueCreditNote(creditTarget.id, {
        reason: creditReason.trim(),
        creditNoteCode: creditCode,
        cancelSale: creditCancelSale,
      });
      setShowCreditModal(false);
      setCreditTarget(null);
      setCreditReason("");
      await loadInvoices();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error al emitir nota de crédito",
      );
    } finally {
      setSubmittingCredit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <FileCheck className="h-7 w-7 shrink-0 text-[#8b4d31]" aria-hidden="true" />
            Facturación Electrónica SUNAT
          </h2>
          <p className="text-xs text-slate-500">
            Comprobantes oficiales: Boletas, Facturas, Notas de Crédito y Guías
            de Remisión
          </p>
        </div>

        <div className="flex items-center gap-2">
          {billingReady && <button
            type="button"
            onClick={() => void handleCheckConnection()}
            disabled={checkingConnection}
            className="rounded-xl border border-[#8b4d31] px-4 py-2 text-sm font-semibold text-[#8b4d31] hover:bg-[#f7eee8] disabled:opacity-50"
          >
            {checkingConnection ? "Comprobando..." : "Comprobar conexión"}
          </button>}
          <button
            onClick={() => void loadInvoices()}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Recargar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!billingReady && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">La emisión electrónica está desactivada. Puedes probar ventas y cobros; configura el proveedor de facturación antes de enviar comprobantes.</div>}
      {connectionResult && <div role="status" className={`rounded-xl border p-4 text-sm ${connectionResult.ok ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900"}`}>{connectionResult.message}</div>}

      {/* Filters Toolbar */}
      <ModuleStats loading={loading} items={[
        { label: "Comprobantes en la lista", value: invoices.length, icon: FileText, detail: "Según filtros y búsqueda", tone: "navy" },
        { label: "Aceptados", value: invoices.filter(i => i.status === "ACCEPTED").length, icon: CheckCircle2, detail: "De los comprobantes visibles", tone: "green" },
        { label: "Por revisar", value: invoices.filter(i => ["PENDING", "ERROR", "REJECTED"].includes(i.status)).length, icon: FileWarning, detail: "De los comprobantes visibles", tone: "amber" },
      ]} />
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Tipo:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="ALL">Todos los tipos</option>
              <option value="BOLETA">Boletas</option>
              <option value="FACTURA">Facturas</option>
              <option value="NOTA_CREDITO">Notas de Crédito</option>
              <option value="GUIA_REMISION">Guías de Remisión</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Estado SUNAT:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
            >
              <option value="ALL">Todos los estados</option>
              <option value="ACCEPTED">Aceptados</option>
              <option value="OBSERVED">Observados</option>
              <option value="PENDING">Pendientes</option>
              <option value="REJECTED">Rechazados</option>
              <option value="ERROR">Con error</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar serie, número o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          >
          </input>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            Cargando comprobantes...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm">No se encontraron comprobantes emitidos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Comprobante</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Cliente / Receptor</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-center">Estado SUNAT</th>
                  <th className="px-5 py-3">Respuesta SUNAT</th>
                  <th className="px-5 py-3 text-right">Archivos / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {invoices.map((inv) => {
                  const isSyncing = syncingId === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => { setShowDesign(false); setSelectedInvoice(inv); }}
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-black text-slate-900 text-sm block">
                          {inv.serie}-{String(inv.number).padStart(8, "0")}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {inv.type}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(inv.createdAt).toLocaleDateString("es-PE", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 truncate max-w-xs">
                          {inv.customerName}
                        </div>
                        <span className="text-slate-400 text-[10px] font-mono block">
                          {inv.customerDocumentType === "6"
                            ? "RUC"
                            : inv.customerDocumentType === "1"
                              ? "DNI"
                              : "DOC"}
                          : {inv.customerDocument}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                        S/ {Number(inv.total).toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            inv.sunatAccepted
                              ? "bg-emerald-50 text-emerald-700"
                              : inv.status === "OBSERVED"
                                ? "bg-amber-50 text-amber-700"
                                : inv.status === "REJECTED"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {inv.sunatAccepted ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : inv.status === "REJECTED" ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {inv.sunatAccepted
                            ? "Aceptado"
                            : inv.status === "PENDING"
                              ? "Pendiente"
                              : inv.status === "OBSERVED"
                                ? "Observado"
                                : inv.status === "REJECTED"
                                  ? "Rechazado"
                                  : "Error"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                        {inv.sunatDescription || (
                          <span className="text-slate-400 italic">
                            Sin respuesta aún
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1">
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-700"
                          >
                            PDF Nubefact
                          </a>
                        )}
                        {(inv.type === "BOLETA" || inv.type === "FACTURA") && inv.providerPayload?.items?.length ? (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); setShowDesign(true); }} className="px-2 py-1 bg-[#f6eae2] hover:bg-[#eed8ca] rounded font-bold text-[#8b4d31]">Diseño de prueba</button>
                        ) : null}
                        {inv.cdrUrl && (
                          <a
                            href={inv.cdrUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded font-bold text-emerald-800"
                          >
                            CDR
                          </a>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleSync(inv.id);
                          }}
                          disabled={isSyncing}
                          className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded font-bold"
                          title="Sincronizar con SUNAT"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 inline ${
                              isSyncing ? "animate-spin" : ""
                            }`}
                          />
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

      {/* DETAIL MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block">
                  ID: {selectedInvoice.id}
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedInvoice.type} {selectedInvoice.serie}-
                  {String(selectedInvoice.number).padStart(8, "0")}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Status & Response Alert */}
            <div
              className={`p-4 rounded-xl border space-y-1.5 ${
                selectedInvoice.sunatAccepted
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : selectedInvoice.status === "REJECTED"
                    ? "bg-red-50 border-red-200 text-red-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                {selectedInvoice.sunatAccepted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                )}
                <span>
                  Respuesta Oficial SUNAT:{" "}
                  {selectedInvoice.sunatAccepted ? "ACEPTADO" : selectedInvoice.status}
                </span>
              </div>
              <p className="text-xs">
                {selectedInvoice.sunatDescription ||
                  "Comprobante registrado en el backend; esperando conexión con Nubefact/SUNAT."}
              </p>
              {selectedInvoice.sunatSoapError && (
                <p className="text-[11px] font-mono text-red-700 bg-white/60 p-2 rounded">
                  {selectedInvoice.sunatSoapError}
                </p>
              )}
            </div>

            {/* Document Data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 block font-semibold">
                  Cliente / Destinatario
                </span>
                <div className="font-bold text-slate-900">
                  {selectedInvoice.customerName}
                </div>
                <div className="font-mono text-slate-600">
                  Doc: {selectedInvoice.customerDocument}
                </div>
                {selectedInvoice.customerAddress && (
                  <div className="text-slate-500 text-[11px]">
                    {selectedInvoice.customerAddress}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <span className="text-slate-400 block font-semibold">
                  Desglose Económico (PEN)
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-semibold text-slate-800">
                    S/ {Number(selectedInvoice.subtotal).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    IGV ({selectedInvoice.igvType}):
                  </span>
                  <span className="font-semibold text-slate-800">
                    S/ {Number(selectedInvoice.igv).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total:</span>
                  <span>S/ {Number(selectedInvoice.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Official Links */}
            {(selectedInvoice.type === "BOLETA" || selectedInvoice.type === "FACTURA") && selectedInvoice.providerPayload?.items?.length ? <div className="space-y-3">
              <button type="button" onClick={() => setShowDesign(!showDesign)} className="rounded-xl border border-[#8b4d31] px-3 py-2 font-bold text-[#8b4d31]">{showDesign ? "Ocultar diseño personalizado" : "Ver diseño personalizado"}</button>
              {showDesign && <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white p-3">
                <p className="mb-3 rounded-lg bg-amber-50 p-2 font-semibold text-amber-900">Vista previa sin validez: usa el PDF de Nubefact para entregar el comprobante.</p>
                <button type="button" onClick={() => window.print()} className="mb-3 rounded-xl bg-[#8b4d31] px-3 py-2 font-bold text-white">Imprimir o guardar vista previa como PDF</button>
                <div id="invoice-design-print" className="relative min-w-[610px] border border-slate-800 bg-white p-4 text-slate-900">
                  <div className="mb-4 flex items-center justify-between gap-4 border-b-2 border-[#102b52] pb-3"><img src="/silva-logo-products.png" alt="Distribuciones Silva" className="max-h-20 w-64 object-contain" /><div className="border border-slate-800 text-center"><div className="bg-[#102b52] px-4 py-2 font-bold text-white">{selectedInvoice.type === "BOLETA" ? "BOLETA DE VENTA ELECTRÓNICA" : "FACTURA ELECTRÓNICA"}</div><div className="p-2 font-bold">{selectedInvoice.serie}-{String(selectedInvoice.number).padStart(8, "0")}</div></div></div>
                  <div className="mb-4 border border-slate-700"><div className="border-b border-slate-400 p-2"><b>Cliente:</b> {selectedInvoice.customerName}</div><div className="border-b border-slate-400 p-2"><b>Documento:</b> {selectedInvoice.customerDocument || "—"}</div><div className="p-2"><b>Fecha de emisión:</b> {selectedInvoice.providerPayload.fecha_de_emision || "—"} · <b>Moneda:</b> Soles</div></div>
                  <table className="w-full table-fixed border-collapse text-left text-[10px]"><thead className="bg-[#102b52] text-white"><tr>{["Cant.", "UM", "Código", "Presentación y descripción", "V/U", "P/U", "Importe"].map(label => <th key={label} className={`border border-slate-700 p-2 ${label === "Presentación y descripción" ? "w-[32%]" : ""}`}>{label}</th>)}</tr></thead><tbody>{selectedInvoice.providerPayload.items.map((item, index) => <tr key={index}>{[item.cantidad, item.unidad_de_medida === "NIU" ? "UNIDAD (NIU)" : item.unidad_de_medida, item.codigo, item.descripcion, Number(item.valor_unitario).toLocaleString("es-PE", {minimumFractionDigits: 2, maximumFractionDigits: 6}), Number(item.precio_unitario).toFixed(2), Number(item.total).toFixed(2)].map((value, i) => <td key={i} className="break-words border border-slate-700 p-2">{value}</td>)}</tr>)}</tbody></table>
                  <div className="ml-auto mt-4 w-52 border border-slate-700">{[["Subtotal", selectedInvoice.subtotal], ["IGV", selectedInvoice.igv], ["Total", selectedInvoice.total]].map(([label, amount]) => <div key={label} className="flex justify-between border-b border-slate-400 p-2 last:border-b-0"><b>{label}</b><span>S/ {Number(amount).toFixed(2)}</span></div>)}</div>
                  <p className="mt-4 border border-slate-700 p-2 text-center font-bold text-red-700">VISTA PREVIA - SIN VALIDEZ TRIBUTARIA</p>
                </div>
              </div>}
            </div> : null}
            <div className="space-y-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                Archivos Electrónicos Oficiales
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedInvoice.pdfUrl ? (
                  <a
                    href={selectedInvoice.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    <span>Abrir PDF</span>
                  </a>
                ) : (
                  <span className="text-slate-400 italic">PDF no disponible</span>
                )}

                {selectedInvoice.xmlUrl && (
                  <a
                    href={selectedInvoice.xmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center gap-1.5"
                  >
                    <FileCode className="h-4 w-4" />
                    <span>XML Firmado</span>
                  </a>
                )}

                {selectedInvoice.cdrUrl && (
                  <a
                    href={selectedInvoice.cdrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold flex items-center gap-1.5"
                  >
                    <FileCheck className="h-4 w-4" />
                    <span>Constancia CDR</span>
                  </a>
                )}
              </div>
              <p className="text-slate-500">Abre cada archivo para verlo o guardarlo en tu equipo. El CDR aparecerá cuando esté disponible.</p>
            </div>

            {selectedInvoice.pdfUrl && (() => {
              let pdf: URL;
              try { pdf = new URL(selectedInvoice.pdfUrl); } catch { return null; }
              if (pdf.protocol !== "https:" || !(pdf.hostname === "nubefact.com" || pdf.hostname.endsWith(".nubefact.com"))) return null;
              const number = `${selectedInvoice.serie}-${String(selectedInvoice.number).padStart(8, "0")}`;
              const testLabel = environment === "production" ? "" : "COMPROBANTE DE PRUEBA - SIN VALOR LEGAL\n";
              const message = `${testLabel}Hola, compartimos su ${selectedInvoice.type.toLowerCase()} ${number} de Distribuciones Silva.\nPDF: ${pdf.href}`;
              const phone = sharePhone.replace(/\D/g, "");
              const internationalPhone = phone.length === 9 ? `51${phone}` : phone;
              return <div className="space-y-3 rounded-xl border border-[#eadbd0] bg-[#fffaf6] p-4">
                <h4 className="text-sm font-bold text-slate-900">Compartir comprobante</h4>
                <p className="text-slate-600">Se abrirá un mensaje con el enlace al PDF para que lo revises y envíes. También puedes enviar el correo a tu propia dirección.</p>
                {environment !== "production" && <p className="font-semibold text-amber-800">El mensaje indicará que es una prueba sin valor legal.</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block font-semibold text-slate-700">WhatsApp <input type="tel" value={sharePhone} onChange={e => setSharePhone(e.target.value)} placeholder="Ej. 987654321" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label>
                  <label className="block font-semibold text-slate-700">Correo electrónico <input type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="cliente@ejemplo.com" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {internationalPhone.length >= 10 && internationalPhone.length <= 15 && <a href={`https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white"><MessageCircle className="h-4 w-4" /> Abrir WhatsApp</a>}
                  {shareEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail.trim()) && <a href={`mailto:${encodeURIComponent(shareEmail.trim())}?subject=${encodeURIComponent(`${testLabel ? "[PRUEBA] " : ""}Comprobante ${number} - Distribuciones Silva`)}&body=${encodeURIComponent(message)}`} className="inline-flex items-center gap-2 rounded-lg bg-[#8b4d31] px-3 py-2 font-bold text-white"><Mail className="h-4 w-4" /> Preparar correo</a>}
                </div>
              </div>;
            })()}

            {/* Footer Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              {selectedInvoice.sunatAccepted &&
              (selectedInvoice.type === "FACTURA" ||
                selectedInvoice.type === "BOLETA") ? (
                <button
                  onClick={() => {
                    setCreditTarget(selectedInvoice);
                    setShowCreditModal(true);
                  }}
                  className="text-red-600 hover:text-red-700 font-bold"
                >
                  Emitir Nota de Crédito
                </button>
              ) : (
                <button
                  onClick={() => void handleSync(selectedInvoice.id)}
                  disabled={syncingId === selectedInvoice.id}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100"
                >
                  Sincronizar con SUNAT
                </button>
              )}

              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: EMITIR NOTA DE CRÉDITO */}
      {showCreditModal && creditTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Emitir Nota de Crédito para {creditTarget.type}{" "}
              {creditTarget.serie}-{creditTarget.number}
            </h4>

            <form onSubmit={handleIssueCreditNote} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Código Motivo SUNAT
                </label>
                <select
                  value={creditCode}
                  onChange={(e) => setCreditCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                >
                  <option value="01">01 - Anulación de la operación</option>
                  <option value="02">02 - Anulación por error en el RUC</option>
                  <option value="06">06 - Devolución total</option>
                  <option value="07">07 - Devolución por ítem</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo o Sustento *
                </label>
                <textarea
                  required
                  rows={3}
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="Ej: Anulación de comprobante por devolución de mercadería"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cancelSaleChk"
                  checked={creditCancelSale}
                  onChange={(e) => setCreditCancelSale(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label
                  htmlFor="cancelSaleChk"
                  className="font-semibold text-slate-700 cursor-pointer"
                >
                  Anular la venta y restituir el stock al aceptarse
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCredit}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingCredit ? "Emitiendo..." : "Confirmar Nota de Crédito"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

