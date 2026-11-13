import React, { useEffect, useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "../services/api";

interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  presentation: string;
  unitsPerBox: number;
  price: string;
}

interface CartItem extends CatalogItem {
  quantity: number;
}

export const PublicCatalogView: React.FC = () => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const companyName =
    import.meta.env.VITE_COMPANY_NAME || "Distribuciones Silva";
  const whatsappNumber =
    import.meta.env.VITE_WHATSAPP_NUMBER || "51933070052";
  const phoneDisplay =
    import.meta.env.VITE_PHONE_DISPLAY || "933 070 052";
  const address =
    import.meta.env.VITE_ADDRESS || "Almacén El Progreso";

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const data = await api.getPublicCatalog();
        setItems(data);
      } catch (err) {
        console.error("Error al cargar catálogo público:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addToCart = (product: CatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter((i): i is CartItem => i !== null),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const cartTotal = cart.reduce(
    (sum, i) => sum + Number(i.price) * i.quantity,
    0,
  );

  const sendWhatsAppOrder = () => {
    if (cart.length === 0) return;
    const lines = [
      `¡Hola ${companyName}! Quisiera hacer el siguiente pedido mayorista:`,
      "",
      ...cart.map(
        (i) =>
          `• ${i.quantity}x ${i.name} (${i.presentation}) - S/ ${(
            Number(i.price) * i.quantity
          ).toFixed(2)}`,
      ),
      "",
      `*Total estimado: S/ ${cartTotal.toFixed(2)}*`,
      "",
      "Por favor me confirman disponibilidad y despacho.",
    ];

    const message = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku.toLowerCase().includes(search.toLowerCase()) ||
      i.presentation.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-500/10 via-brand-50 to-white pt-12 pb-16 px-4 sm:px-6 lg:px-8 border-b border-amber-100">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-amber-700" />
            Distribuidora Familiar Mayorista
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Chocolates y Golosinas por <br className="hidden sm:inline" />
            <span className="text-brand-600">Cajas Máster y Docenas</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600">
            Especialistas en <strong>Triángulo Donofrio</strong>, todas las
            variedades de <strong>Sublime</strong>, multipacks,{" "}
            <strong>Morochas</strong> y <strong>Bon o Bon</strong>. Arma tu
            pedido mezclando productos con los mejores precios mayoristas.
          </p>

          {/* Quick Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 max-w-3xl mx-auto text-left">
            <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-amber-100 shadow-sm flex items-start gap-3">
              <Boxes className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Cajas Máster y Pequeñas
                </h4>
                <p className="text-xs text-slate-500">
                  Por máster completa, docenas, 4, 6 o cantidades pactadas.
                </p>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-amber-100 shadow-sm flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Pedidos Mixtos
                </h4>
                <p className="text-xs text-slate-500">
                  Combina marcas y presentaciones según la rotación de tu negocio.
                </p>
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur p-4 rounded-xl border border-amber-100 shadow-sm flex items-start gap-3">
              <Phone className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Atención Directa
                </h4>
                <p className="text-xs text-slate-500">
                  Trato familiar rápido con boleta, factura y despacho.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog & Order Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Products List (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Catálogo con Precios Visibles
                </h2>
                <p className="text-sm text-slate-500">
                  Precios por presentación en Soles (PEN).
                </p>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar Sublime, Triángulo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center text-slate-400">
                Cargando catálogo en tiempo real...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
                <Boxes className="h-10 w-10 text-slate-300 mx-auto" />
                <h3 className="text-base font-semibold text-slate-800">
                  No se encontraron productos publicados
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  {search
                    ? "Prueba buscando con otro término."
                    : "Los productos publicados en el panel aparecerán aquí automáticamente."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4 group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
                        <span>SKU: {product.sku}</span>
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">
                          {product.unitsPerBox} unid / caja
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition">
                        {product.name}
                      </h3>
                      <p className="text-sm text-slate-500 font-medium">
                        {product.presentation}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div>
                        <span className="text-xs text-slate-400 block">
                          Precio por caja
                        </span>
                        <span className="text-2xl font-black text-slate-900">
                          S/ {Number(product.price).toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white rounded-xl text-sm font-semibold transition shadow-sm"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sticky Order Cart (1 col) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-24 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-brand-600" />
                <h3 className="font-bold text-slate-900">Arma tu Pedido</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {cart.reduce((n, i) => n + i.quantity, 0)} cajas
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Boxes className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm">
                  Haz clic en <strong>Agregar</strong> en los productos que
                  necesites para armar tu cotización.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-72 overflow-y-auto space-y-3 pr-1 divide-y divide-slate-100">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="pt-3 first:pt-0 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {item.name}
                        </h4>
                        <span className="text-xs text-slate-500 block truncate">
                          {item.presentation} • S/ {item.price} c/u
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <button
                            onClick={() => updateCartQty(item.id, -1)}
                            className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            -
                          </button>
                          <span className="px-2 py-0.5 text-xs font-bold text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQty(item.id, 1)}
                            className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-sm text-slate-500 font-medium">
                    Total Estimado:
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    S/ {cartTotal.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={sendWhatsAppOrder}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 transition"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Enviar Pedido a WhatsApp</span>
                </button>
              </div>
            )}

            {/* Contact info box */}
            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Teléfono / WhatsApp: {phoneDisplay}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Ubicación: {address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Horario: Lunes a Sábado desde temprano</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

