import React, { useState } from "react";
import { AlertCircle, Boxes, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface LoginViewProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onCancel }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Credenciales inválidas. Verifica tu correo y contraseña.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/30 mx-auto">
            <Boxes className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Panel Familiar</h2>
          <p className="text-sm text-slate-500">
            Ingreso exclusivo para gestión mayorista, ventas e inventario
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                title={showPassword ? "Ocultar" : "Mostrar"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2"
          >
            {loading ? "Iniciando sesión..." : "Ingresar al Panel"}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
          >
            ← Volver a la web pública
          </button>
        </div>
      </div>
    </div>
  );
};

