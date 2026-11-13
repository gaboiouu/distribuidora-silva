import React, { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { ModuleStats } from "../../components/ModuleStats";
import { Role, User } from "../../types";

export const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // New User Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("MEMBER");
  const [submittingNew, setSubmittingNew] = useState(false);

  // Password Reset Modal
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [submittingReset, setSubmittingReset] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers({ take: 50 });
      setUsers(data);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim() || newPassword.length < 14) {
      alert("La contraseña debe tener mínimo 14 caracteres.");
      return;
    }
    setSubmittingNew(true);
    try {
      await api.createUser({
        email: newEmail.trim().toLowerCase(),
        name: newName.trim(),
        password: newPassword,
        role: newRole,
      });
      setShowNewModal(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("MEMBER");
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setSubmittingNew(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    const nextState = !u.active;
    const confirmMsg = nextState
      ? `¿Deseas activar la cuenta de ${u.name}?`
      : `¿Deseas suspender la cuenta de ${u.name}? Sus sesiones activas se revocarán de inmediato.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.updateUser(u.id, { active: nextState });
      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, active: nextState } : item)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al actualizar estado");
    }
  };

  const handleChangeRole = async (u: User, nextRole: Role) => {
    try {
      await api.updateUser(u.id, { role: nextRole });
      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, role: nextRole } : item)),
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cambiar rol");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || resetPass.length < 14) {
      alert("La nueva contraseña debe tener entre 14 y 128 caracteres.");
      return;
    }
    setSubmittingReset(true);
    try {
      await api.resetUserPassword(resetTarget.id, resetPass);
      alert(
        `Contraseña actualizada para ${resetTarget.name}. Sus sesiones previas se han cerrado.`,
      );
      setResetTarget(null);
      setResetPass("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setSubmittingReset(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <Users className="h-7 w-7 shrink-0 text-[#8b4d31]" aria-hidden="true" />
            Cuentas y Accesos de la Familia
          </h2>
          <p className="text-xs text-slate-500">
            Administración de permisos (ADMIN / MEMBER) y contraseñas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadUsers()}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Recargar"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            <span>Crear Cuenta Familiar</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <ModuleStats loading={loading} items={[
        { label: "Cuentas cargadas", value: users.length, icon: Users, detail: "Miembros del panel", tone: "navy" },
        { label: "Cuentas activas", value: users.filter(u => u.active).length, icon: UserCheck, detail: "Pueden iniciar sesión", tone: "green" },
        { label: "Administradores", value: users.filter(u => u.role === "ADMIN" && u.active).length, icon: Shield, detail: "Con acceso completo" },
      ]} />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm divide-y divide-slate-100">
            <thead className="bg-slate-50/75 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Correo</th>
                <th className="px-5 py-3">Rol de Acceso</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3">Creado el</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3.5 font-bold text-slate-900">
                    {u.name}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-slate-600">
                    {u.email}
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        void handleChangeRole(u, e.target.value as Role)
                      }
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-bold text-xs"
                    >
                      <option value="MEMBER">MEMBER (Ventas y Almacén)</option>
                      <option value="ADMIN">ADMIN (Control Total)</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => void handleToggleActive(u)}
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        u.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {u.active ? "Activo" : "Suspendido"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString("es-PE", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                    <button
                      onClick={() => {
                        setResetTarget(u);
                        setResetPass("");
                      }}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-bold inline-flex items-center gap-1"
                    >
                      <KeyRound className="h-3 w-3" />
                      <span>Cambiar Clave</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NUEVO USUARIO */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Crear Nueva Cuenta Familiar
            </h4>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Gabriel Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  placeholder="familiar@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contraseña Temporal (mínimo 14 caracteres) *
                </label>
                <input
                  type="password"
                  required
                  minLength={14}
                  maxLength={128}
                  placeholder="••••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Segura: usa mayúsculas, números o guiones (ej. Distribuidora-2026)
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Permiso / Rol
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold"
                >
                  <option value="MEMBER">MEMBER (Ventas, Cobros, Almacén)</option>
                  <option value="ADMIN">ADMIN (Acceso Total y Compras)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingNew}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingNew ? "Creando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h4 className="font-bold text-slate-900 text-base">
              Resetear Contraseña de {resetTarget.name}
            </h4>
            <p className="text-slate-500 text-xs">
              Al guardar, se revocarán todas sus sesiones activas y deberá iniciar
              sesión con la nueva contraseña.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nueva Contraseña (mínimo 14 caracteres) *
                </label>
                <input
                  type="password"
                  required
                  minLength={14}
                  maxLength={128}
                  placeholder="••••••••••••••"
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReset}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-sm"
                >
                  {submittingReset ? "Guardando..." : "Guardar Nueva Contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

