import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  Check,
  Edit2,
  FolderSync,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { ModuleStats } from "../../components/ModuleStats";
import { Product, StockMovement } from "../../types";

interface InventoryTabProps {
  initialOpenAdjust?: boolean;
  onClearInitialOpenAdjust?: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({
  initialOpenAdjust,
  onClearInitialOpenAdjust,
}) => {
  const [subTab, setSubTab] = useState<"products" | "movements">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(
    Boolean(initialOpenAdjust),
  );
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [showPackagingModal, setShowPackagingModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // New Product Form
  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newPres, setNewPres] = useState("Caja de 24");
  const [newUnits, setNewUnits] = useState(24);
  const [newPrice, setNewPrice] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newInitialStock, setNewInitialStock] = useState(0);
  const [newPublished, setNewPublished] = useState(true);
  const [submittingProduct, setSubmittingProduct] = useState(false);

  // Stock Adjustment Form
  const [adjProdId, setAdjProdId] = useState("");
  const [adjDelta, setAdjDelta] = useState(10);
  const [adjReason, setAdjReason] = useState<
    "INITIAL_STOCK" | "COUNT_CORRECTION" | "DAMAGE" | "OTHER"
  >("INITIAL_STOCK");
  const [adjNotes, setAdjNotes] = useState("");
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Master Conversion Form
  const [convMasterId, setConvMasterId] = useState("");
  const [convQty, setConvQty] = useState(1);
  const [submittingConv, setSubmittingConv] = useState(false);

  // Packaging Config Form
  const [packMasterId, setPackMasterId] = useState("");
  const [packBoxId, setPackBoxId] = useState("");
  const [packBoxesPerMaster, setPackBoxesPerMaster] = useState(12);
  const [submittingPack, setSubmittingPack] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, movs] = await Promise.all([
        api.getProducts({ take: 100, q: search || undefined }),
        api.getMovements({ take: 50 }),
      ]);
      setProducts(prods);
      setMovements(movs);
      if (prods.length > 0 && !adjProdId) {
        setAdjProdId(prods[0].id);
      }
    } catch (err) {
      console.error("Error al cargar inventario:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [search]);

  useEffect(() => {
    if (initialOpenAdjust) {
      setShowAdjustModal(true);
      onClearInitialOpenAdjust?.();
    }
  }, [initialOpenAdjust]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingProduct(true);
    try {
      await api.createProduct({
        sku: newSku.trim().toUpperCase(),
        name: newName.trim(),
        presentation: newPres.trim(),
        unitsPerBox: Number(newUnits),
        price: Number(newPrice).toFixed(2),
        cost: Number(newCost).toFixed(2),
        initialStock: Number(newInitialStock),
        published: newPublished,
        active: true,
      });
      setShowNewModal(false);
      setNewSku("");
      setNewName("");
      setNewPrice("");
      setNewCost("");
      setNewInitialStock(0);
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error al crear el producto",
      );
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjProdId || adjDelta === 0) return;
    setSubmittingAdjust(true);
    try {
      await api.adjustStock({
        productId: adjProdId,
        delta: Number(adjDelta),
        reason: adjReason,
        notes: adjNotes.trim() || undefined,
      });
      setShowAdjustModal(false);
      setAdjNotes("");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al ajustar stock");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleConvertMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convMasterId || convQty <= 0) return;
    setSubmittingConv(true);
    try {
      await api.convertMaster({
        masterProductId: convMasterId,
        masterQuantity: Number(convQty),
      });
      setShowConversionModal(false);
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error en apertura de máster",
      );
    } finally {
      setSubmittingConv(false);
    }
  };

  const handleConfigurePackaging = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packMasterId || !packBoxId || packBoxesPerMaster <= 0) return;
    setSubmittingPack(true);
    try {
      await api.configurePackaging(packMasterId, {
        boxProductId: packBoxId,
        boxesPerMaster: Number(packBoxesPerMaster),
      });
      setShowPackagingModal(false);
      await loadData();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error al vincular empaque",
      );
    } finally {
      setSubmittingPack(false);
    }
  };

  const togglePublish = async (prod: Product) => {
    try {
      await api.updateProduct(prod.id, { published: !prod.published });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === prod.id ? { ...p, published: !p.published } : p,
        ),
      );
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Error al cambiar visibilidad",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <Boxes className="h-7 w-7 shrink-0 text-[#8b4d31]" aria-hidden="true" />
            Control de Inventario y Almacén
          </h2>
          <p className="text-xs text-slate-500">
            Existencias por cajas, cajas máster, aperturas y ajustes manuales
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => setShowPackagingModal(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Vincular Máster</span>
          </button>

          <button
            onClick={() => setShowConversionModal(true)}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <FolderSync className="h-3.5 w-3.5" />
            <span>Abrir Máster</span>
          </button>

          <button
            onClick={() => setShowAdjustModal(true)}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span>Ajustar Stock</span>
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Subtabs and Search */}
      <ModuleStats loading={loading} items={[
        { label: "Productos en la lista", value: products.length, icon: Package, detail: "Según la búsqueda actual", tone: "navy" },
        { label: "Cajas máster", value: products.filter(p => Boolean(p.boxProductId)).length, icon: Boxes, detail: "Presentaciones vinculadas" },
        { label: "Stock bajo", value: products.filter(p => p.active && p.stock <= 5).length, icon: AlertTriangle, detail: "5 cajas o menos en esta lista", tone: "amber" },
      ]} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setSubTab("products")}
            className={`px-4 py-1.5 rounded-lg transition ${
              subTab === "products"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Productos y Cajas ({products.length})
          </button>
          <button
            onClick={() => setSubTab("movements")}
            className={`px-4 py-1.5 rounded-lg transition ${
              subTab === "movements"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Kardex / Movimientos
          </button>
        </div>

        {subTab === "products" && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar SKU o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}
      </div>

      {/* SUBTAB 1: PRODUCTS TABLE */}
      {subTab === "products" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Producto / Presentación</th>
                  <th className="px-5 py-3 text-center">Unid / Caja</th>
                  <th className="px-5 py-3 text-center">Stock Disponible</th>
                  <th className="px-5 py-3 text-right">Precio Venta</th>
                  <th className="px-5 py-3 text-right">Costo Compra</th>
                  <th className="px-5 py-3 text-center">Web Pública</th>
                  <th className="px-5 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {products.map((product) => {
                  const isLowStock = product.stock <= 5;
                  const isMaster = Boolean(product.boxProductId);

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="px-5 py-3.5 font-mono text-slate-500 font-bold whitespace-nowrap">
                        {product.sku}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {product.name}
                        </div>
                        <div className="text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{product.presentation}</span>
                          {isMaster && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                              Máster (contiene {product.boxesPerMaster} cajas)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-center text-slate-600 font-semibold">
                        {product.unitsPerBox}
                      </td>

                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${
                            isLowStock
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isLowStock && (
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                          )}
                          {product.stock} cajas
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                        S/ {Number(product.price).toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 text-right text-slate-500 whitespace-nowrap font-semibold">
                        S/ {Number(product.cost).toFixed(2)}
                      </td>

                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => void togglePublish(product)}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition ${
                            product.published
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          {product.published ? "Visible" : "Oculto"}
                        </button>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setAdjProdId(product.id);
                            setShowAdjustModal(true);
                          }}
                          className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded-lg font-bold"
                        >
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: MOVEMENTS (KARDEX) */}
      {subTab === "movements" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Fecha y Hora</th>
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3 text-center">Variación</th>
                  <th className="px-5 py-3">Motivo / Operación</th>
                  <th className="px-5 py-3">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {movements.map((mov) => {
                  const isPositive = mov.quantity > 0;
                  const prod = products.find((p) => p.id === mov.productId);

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(mov.createdAt).toLocaleDateString("es-PE", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="px-5 py-3 font-bold text-slate-900">
                        {prod ? `${prod.name} (${prod.presentation})` : mov.productId}
                      </td>

                      <td className="px-5 py-3 text-center whitespace-nowrap">
                        <span
                          className={`font-black px-2.5 py-0.5 rounded-full ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {isPositive ? `+${mov.quantity}` : mov.quantity} cajas
                        </span>
                      </td>

                      <td className="px-5 py-3 text-slate-700 font-semibold">
                        {mov.reason}
                      </td>

                      <td className="px-5 py-3 font-mono text-[10px] text-slate-400">
                        {mov.reference || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO PRODUCTO */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Crear Nuevo Producto en Almacén
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Código SKU *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="SUB-24"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unidades por caja *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newUnits}
                    onChange={(e) => setNewUnits(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Sublime Clásico / Triángulo Donofrio / Morochas..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Presentación *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Caja de 24 unid / Caja Máster x 12 display"
                  value={newPres}
                  onChange={(e) => setNewPres(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Precio Venta (S/) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="48.00"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Costo Compra (S/) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="40.00"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Stock Inicial (cajas)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newInitialStock}
                    onChange={(e) =>
                      setNewInitialStock(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-brand-600"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pubCheck"
                  checked={newPublished}
                  onChange={(e) => setNewPublished(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label
                  htmlFor="pubCheck"
                  className="text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Publicar en la web pública para clientes
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingProduct}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-md shadow-brand-600/20"
                >
                  {submittingProduct ? "Guardando..." : "Crear Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJUSTE DE STOCK */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Ajuste Directo de Inventario
            </h4>
            <p className="text-slate-500 text-xs">
              Suma o resta cajas en almacén sin registrar compras con proveedores.
            </p>

            <form onSubmit={handleAdjustStock} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Producto a Ajustar *
                </label>
                <select
                  required
                  value={adjProdId}
                  onChange={(e) => setAdjProdId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.presentation}) - Stock: {p.stock}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cajas a Sumar (+) o Restar (-) *
                </label>
                <input
                  type="number"
                  required
                  value={adjDelta}
                  onChange={(e) => setAdjDelta(parseInt(e.target.value) || 0)}
                  placeholder="Ej: 10 o -2"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-center text-base"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo
                </label>
                <select
                  value={adjReason}
                  onChange={(e) =>
                    setAdjReason(
                      e.target.value as
                        | "INITIAL_STOCK"
                        | "COUNT_CORRECTION"
                        | "DAMAGE"
                        | "OTHER",
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold"
                >
                  <option value="INITIAL_STOCK">Carga de Stock Inicial</option>
                  <option value="COUNT_CORRECTION">
                    Corrección por Conteo Físico
                  </option>
                  <option value="DAMAGE">Merma o Producto Dañado</option>
                  <option value="OTHER">Otro Motivo</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nota / Observación (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Conteo de fin de semana"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingAdjust ? "Guardando..." : "Confirmar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APERTURA DE MÁSTER */}
      {showConversionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Apertura de Caja Máster
            </h4>
            <p className="text-slate-500 text-xs">
              Descuenta cajas máster e ingresa sus cajas pequeñas automáticamente
              con sus costos prorrateados.
            </p>

            <form onSubmit={handleConvertMaster} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Caja Máster a Abrir *
                </label>
                <select
                  required
                  value={convMasterId}
                  onChange={(e) => setConvMasterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                >
                  <option value="">Selecciona una máster configurada...</option>
                  {products
                    .filter((p) => p.boxProductId && p.boxesPerMaster)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.presentation}) - Stock: {p.stock}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Número de Máster que se abren *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={convQty}
                  onChange={(e) => setConvQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-center text-base"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConversionModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingConv}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingConv ? "Abriendo..." : "Confirmar Apertura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR MÁSTER CON CAJA PEQUEÑA */}
      {showPackagingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Vincular Presentación Máster
            </h4>
            <p className="text-slate-500 text-xs">
              Define qué caja pequeña contiene cada máster y cuántas vienen por
              caja.
            </p>

            <form onSubmit={handleConfigurePackaging} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Producto Máster *
                </label>
                <select
                  required
                  value={packMasterId}
                  onChange={(e) => setPackMasterId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                >
                  <option value="">Selecciona la máster...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.presentation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Caja Pequeña que contiene *
                </label>
                <select
                  required
                  value={packBoxId}
                  onChange={(e) => setPackBoxId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                >
                  <option value="">Selecciona la caja pequeña...</option>
                  {products
                    .filter((p) => p.id !== packMasterId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.presentation})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Cajas pequeñas por cada máster *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={packBoxesPerMaster}
                  onChange={(e) =>
                    setPackBoxesPerMaster(parseInt(e.target.value) || 1)
                  }
                  placeholder="Ej: 12 o 24"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-center"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPackagingModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingPack}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingPack ? "Guardando..." : "Guardar Vinculación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

