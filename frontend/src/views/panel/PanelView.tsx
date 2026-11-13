import React, { useEffect, useRef, useState } from "react";
import {
  Boxes,
  Building2,
  DollarSign,
  ChartNoAxesCombined,
  FileCheck2,
  House,
  Receipt,
  ShoppingBag,
  Users,
  ExternalLink,
  LogOut,
  UserRound,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { BillingTab } from "./BillingTab";
import { FinanceTab } from "./FinanceTab";
import { CustomersSuppliersTab } from "./CustomersSuppliersTab";
import { ExecutiveDashboard } from "./ExecutiveDashboard";
import { InventoryTab } from "./InventoryTab";
import { PurchasesExpensesTab } from "./PurchasesExpensesTab";
import { ReceivablesTab } from "./ReceivablesTab";
import { SalesTab } from "./SalesTab";
import { UsersTab } from "./UsersTab";
import "./panel-theme.css";

export const PanelView: React.FC<{ onNavigate: (view: "public" | "panel" | "login") => void }> = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [environment, setEnvironment] = useState<"development" | "staging" | "production" | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    void api.getHealth().then((health) => {
      if (mounted) setEnvironment(health.environment);
    }).catch(() => { if (mounted) setEnvironment(null); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [accountOpen]);

  // Shortcuts states
  const [openNewSale, setOpenNewSale] = useState(false);
  const [openAdjust, setOpenAdjust] = useState(false);

  const menuItems = [
    { id: "dashboard", label: "Resumen General", icon: House },
    ...(user?.role === "ADMIN" ? [{ id: "finance", label: "Inversión y Ganancias", icon: ChartNoAxesCombined }] : []),
    { id: "sales", label: "Ventas Mayoristas", icon: ShoppingBag },
    { id: "inventory", label: "Inventario y Cajas", icon: Boxes },
    { id: "receivables", label: "Cuentas por Cobrar", icon: DollarSign },
    { id: "billing", label: "Facturación SUNAT", icon: FileCheck2 },
    { id: "purchases", label: "Compras y Gastos", icon: Receipt },
    { id: "partners", label: "Clientes y Proveedores", icon: Building2 },
    ...(user?.role === "ADMIN"
      ? [{ id: "users", label: "Cuentas Familiares", icon: Users }]
      : []),
  ];

  return (
    <div className="silva-panel min-h-screen lg:flex">
        {/* Navigation Sidebar */}
        <aside className="silva-sidebar flex w-full shrink-0 flex-col p-5 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:overflow-y-auto lg:px-5 lg:py-8">
          <div className="flex items-center justify-between gap-3 lg:block">
          <div className="silva-sidebar-brand w-44 pb-0 pt-0 lg:w-full lg:pb-5 lg:pt-2">
            <div className="silva-sidebar-logo">
              <img src="/silva-logo-products.png" alt="Distribuciones Silva" className="h-auto w-full object-contain" />
              <span aria-hidden="true" className="silva-sidebar-logo-white" />
            </div>
          </div>
          <button type="button" className="flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white lg:hidden" aria-expanded={mobileMenuOpen} aria-controls="panel-navigation" onClick={() => setMobileMenuOpen(open => !open)}>{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />} Menú</button>
          </div>
          <div className={`${mobileMenuOpen ? "block" : "hidden"} px-3 pb-3 pt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#d7b79d] lg:block`}>Panel de gestión</div>
          <nav id="panel-navigation" className={`${mobileMenuOpen ? "block" : "hidden"} space-y-1 lg:block`} aria-label="Módulos del panel">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#a96643] text-white shadow-sm"
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      isActive ? "text-white" : "text-[#d7b79d]"
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="min-w-0 flex-1">
          <div className="flex justify-end px-5 pt-5 sm:px-8 lg:px-10">
            <span className={`mr-3 self-center rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${environment === "production" ? "bg-emerald-100 text-emerald-800" : environment ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"}`}>{environment === "staging" ? "Pruebas" : environment === "production" ? "Producción" : environment === "development" ? "Desarrollo" : "Entorno sin verificar"}</span>
            <div className="relative" ref={accountMenuRef}>
              <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl border border-[#e6d9cd] bg-white px-3 py-2 text-sm font-semibold text-[#15243d] shadow-sm hover:bg-[#fffaf6]">
                <UserRound className="h-4 w-4 text-[#8b4d31]" />
                <span className="max-w-36 truncate">{user?.name}</span>
                <span className="hidden text-xs font-bold text-[#8b4d31] sm:inline">{user?.role}</span>
                <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${accountOpen ? "rotate-180" : ""}`} />
              </button>
              {accountOpen && <div role="menu" className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[#e6d9cd] bg-white p-1.5 shadow-xl">
                <button role="menuitem" onClick={() => { setAccountOpen(false); onNavigate("public"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#15243d] hover:bg-[#f7f3ee]"><ExternalLink className="h-4 w-4 text-[#8b4d31]" /> Web pública</button>
                <div className="my-1 border-t border-[#e6d9cd]" />
                <button role="menuitem" onClick={() => { setAccountOpen(false); void logout(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#15243d] hover:bg-[#f7f3ee]"><LogOut className="h-4 w-4 text-[#8b4d31]" /> Salir</button>
              </div>}
            </div>
          </div>
          <main className="w-full px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          {activeTab === "dashboard" && (
            <ExecutiveDashboard
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenNewSale={() => {
                setOpenNewSale(true);
                setActiveTab("sales");
              }}
              onOpenStockAdjust={() => {
                setOpenAdjust(true);
                setActiveTab("inventory");
              }}
            />
          )}

          {activeTab === "sales" && (
            <SalesTab
              initialOpenNewSale={openNewSale}
              onClearInitialOpenNewSale={() => setOpenNewSale(false)}
            />
          )}
          {activeTab === "finance" && user?.role === "ADMIN" && <FinanceTab />}

          {activeTab === "inventory" && (
            <InventoryTab
              initialOpenAdjust={openAdjust}
              onClearInitialOpenAdjust={() => setOpenAdjust(false)}
            />
          )}

          {activeTab === "receivables" && <ReceivablesTab />}

          {activeTab === "billing" && <BillingTab />}

          {activeTab === "purchases" && <PurchasesExpensesTab />}

          {activeTab === "partners" && <CustomersSuppliersTab />}

          {activeTab === "users" && user?.role === "ADMIN" && <UsersTab />}
        </main>
        </div>
    </div>
  );
};

