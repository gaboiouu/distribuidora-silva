import React, { useEffect, useState } from "react";
import {
  Building2,
  Edit2,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { ModuleStats } from "../../components/ModuleStats";
import { Customer, Supplier } from "../../types";

export const CustomersSuppliersTab: React.FC = () => {
  const [subTab, setSubTab] = useState<"customers" | "suppliers">("customers");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [showCustModal, setShowCustModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custName, setCustName] = useState("");
  const [custDoc, setCustDoc] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [submittingCust, setSubmittingCust] = useState(false);

  const [showSuppModal, setShowSuppModal] = useState(false);
  const [suppName, setSuppName] = useState("");
  const [suppDoc, setSuppDoc] = useState("");
  const [suppPhone, setSuppPhone] = useState("");
  const [submittingSupp, setSubmittingSupp] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [custList, suppList] = await Promise.all([
        api.getCustomers({ take: 100, q: search || undefined }),
        api.getSuppliers({ take: 100, q: search || undefined }),
      ]);
      setCustomers(custList);
      setSuppliers(suppList);
    } catch (err) {
      console.error("Error al cargar clientes/proveedores:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [search]);

  const handleOpenNewCustomer = () => {
    setEditingCustomer(null);
    setCustName("");
    setCustDoc("");
    setCustPhone("");
    setCustAddress("");
    setShowCustModal(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustName(c.name);
    setCustDoc(c.document || "");
    setCustPhone(c.phone || "");
    setCustAddress(c.address || "");
    setShowCustModal(true);
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;
    setSubmittingCust(true);
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, {
          name: custName.trim(),
          document: custDoc.trim() || undefined,
          phone: custPhone.trim() || undefined,
          address: custAddress.trim() || undefined,
        });
      } else {
        await api.createCustomer({
          name: custName.trim(),
          document: custDoc.trim() || undefined,
          phone: custPhone.trim() || undefined,
          address: custAddress.trim() || undefined,
        });
      }
      setShowCustModal(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar cliente");
    } finally {
      setSubmittingCust(false);
    }
  };

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppName.trim()) return;
    setSubmittingSupp(true);
    try {
      await api.createSupplier({
        name: suppName.trim(),
        document: suppDoc.trim() || undefined,
        phone: suppPhone.trim() || undefined,
      });
      setShowSuppModal(false);
      setSuppName("");
      setSuppDoc("");
      setSuppPhone("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar proveedor");
    } finally {
      setSubmittingSupp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <Building2 className="h-7 w-7 shrink-0 text-[#8b4d31]" aria-hidden="true" />
            Clientes y Proveedores
          </h2>
          <p className="text-xs text-slate-500">
            Directorio de bodegas mayoristas y distribuidores aliados
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

          {subTab === "customers" ? (
            <button
              onClick={handleOpenNewCustomer}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Cliente</span>
            </button>
          ) : (
            <button
              onClick={() => setShowSuppModal(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Proveedor</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtabs and Search */}
      <ModuleStats loading={loading} items={[
        { label: "Clientes encontrados", value: customers.length, icon: Users, detail: "Según la búsqueda actual", tone: "navy" },
        { label: "Proveedores encontrados", value: suppliers.length, icon: Building2, detail: "Según la búsqueda actual" },
      ]} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setSubTab("customers")}
            className={`px-4 py-1.5 rounded-lg transition ${
              subTab === "customers"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Clientes ({customers.length})
          </button>
          <button
            onClick={() => setSubTab("suppliers")}
            className={`px-4 py-1.5 rounded-lg transition ${
              subTab === "suppliers"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Proveedores ({suppliers.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* SUBTAB 1: CUSTOMERS TABLE */}
      {subTab === "customers" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Nombre / Razón Social</th>
                  <th className="px-5 py-3">RUC / DNI</th>
                  <th className="px-5 py-3">Teléfono / WhatsApp</th>
                  <th className="px-5 py-3">Dirección de Entrega</th>
                  <th className="px-5 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {c.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {c.document || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {c.phone || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                      {c.address || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditCustomer(c)}
                        className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-bold"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && customers.length === 0 && <div className="silva-empty-state"><Users className="h-9 w-9" /><h3>Aún no hay clientes para mostrar</h3><p>{search ? "Prueba con otro nombre o documento." : "Registra tu primer cliente para empezar a crear pedidos."}</p><button onClick={handleOpenNewCustomer}>Nuevo cliente</button></div>}
        </div>
      )}

      {/* SUBTAB 2: SUPPLIERS TABLE */}
      {subTab === "suppliers" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Proveedor</th>
                  <th className="px-5 py-3">Documento / RUC</th>
                  <th className="px-5 py-3">Teléfono</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {s.name}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {s.document || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {s.phone || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && suppliers.length === 0 && <div className="silva-empty-state"><Building2 className="h-9 w-9" /><h3>Aún no hay proveedores para mostrar</h3><p>{search ? "Prueba con otra búsqueda." : "Registra un proveedor para asociarlo a tus compras."}</p><button onClick={() => setShowSuppModal(true)}>Nuevo proveedor</button></div>}
        </div>
      )}

      {/* MODAL: CLIENTE */}
      {showCustModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              {editingCustomer ? "Editar Cliente" : "Nuevo Cliente Mayorista"}
            </h4>
            <form onSubmit={handleSubmitCustomer} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre o Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Bodega San Martín SAC"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  RUC o DNI
                </label>
                <input
                  type="text"
                  placeholder="20123456789 o 12345678"
                  value={custDoc}
                  onChange={(e) => setCustDoc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="987654321"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Dirección de Entrega
                </label>
                <input
                  type="text"
                  placeholder="Av. Los Laureles 123, Puesto 4"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCust}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingCust ? "Guardando..." : "Guardar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROVEEDOR */}
      {showSuppModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Nuevo Proveedor
            </h4>
            <form onSubmit={handleSubmitSupplier} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre del Proveedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nestlé Perú / Distribuidora X"
                  value={suppName}
                  onChange={(e) => setSuppName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  RUC o Documento
                </label>
                <input
                  type="text"
                  placeholder="20100000001"
                  value={suppDoc}
                  onChange={(e) => setSuppDoc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  placeholder="01 2345678"
                  value={suppPhone}
                  onChange={(e) => setSuppPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSuppModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingSupp}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingSupp ? "Guardando..." : "Crear Proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

