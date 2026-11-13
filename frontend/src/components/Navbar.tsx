import React from "react";
import {
  ExternalLink,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface NavbarProps {
  currentView: "public" | "panel" | "login";
  onNavigate: (view: "public" | "panel" | "login") => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto max-w-[1880px] px-4 sm:px-7 lg:px-10 xl:px-12">
        <div className="flex h-20 items-center justify-between gap-4">
          {/* Logo / Brand */}
          <button
            type="button"
            className={`flex items-center gap-3 cursor-pointer text-left ${currentView === "panel" ? "hidden" : ""}`}
            onClick={() => onNavigate(user ? "panel" : "public")}
          >
            <img src="/silva-logo-products.png" alt="Distribuciones Silva" className="h-12 w-32 object-contain object-left sm:w-44" />
            <div>
              <span className="hidden text-sm font-medium text-slate-500 xl:block">
                Chocolates y golosinas al por mayor
              </span>
            </div>
          </button>

          {/* Navigation Actions */}
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            {/* View Switcher */}
            <button
              onClick={() => onNavigate("public")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                currentView === "public"
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Web Pública</span>
            </button>

            {user ? (
              <>
                <button
                  onClick={() => onNavigate("panel")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    currentView === "panel"
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Panel Familiar</span>
                </button>

                <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                    <UserIcon className="h-3 w-3" />
                    {user.name} ({user.role})
                  </span>
                </div>

                <button
                  onClick={() => void logout()}
                  title="Cerrar sesión"
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => onNavigate("login")}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg shadow-sm transition"
              >
                <span>Acceso Familia</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

