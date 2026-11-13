import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, authStorage } from "../services/api";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      if (authStorage.getToken()) {
        const me = await api.getMe();
        setUser(me);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
      authStorage.clearAll();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshUser();

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    await api.login(credentials);
    const me = await api.getMe();
    setUser(me);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

