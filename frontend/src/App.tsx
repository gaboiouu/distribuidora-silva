import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginView } from "./views/LoginView";
import { PanelView } from "./views/panel/PanelView";
import { PublicCatalogView } from "./views/PublicCatalogView";

const MainContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [view, setView] = useState<"public" | "panel" | "login">("public");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm font-medium">
        Cargando Distribuciones Silva...
      </div>
    );
  }

  // Active view router
  let activeView = view;
  if (view === "panel" && !user) {
    activeView = "login";
  }

  return (
    <div className={`min-h-screen flex flex-col text-slate-800 ${activeView === "panel" ? "bg-[#f7f3ee]" : "bg-slate-50"}`}>
      {activeView !== "panel" && <Navbar
        currentView={activeView}
        onNavigate={(targetView) => setView(targetView)}
      />}

      <div className="flex-1">
        {activeView === "public" && <PublicCatalogView />}

        {activeView === "login" && (
          <LoginView
            onSuccess={() => setView("panel")}
            onCancel={() => setView("public")}
          />
        )}

        {activeView === "panel" && user && <PanelView onNavigate={setView} />}
      </div>

      {activeView !== "panel" && <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>
          &copy; {new Date().getFullYear()} Distribuciones Silva. Todos los
          derechos reservados. Golosinas y chocolates al por mayor.
        </p>
      </footer>}
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;

