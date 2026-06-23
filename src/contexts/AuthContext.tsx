// customer-portal/src/contexts/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { User } from "../api";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextType = {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_KEY = "authToken";
const BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const initDone = useRef(false);

  // ── Helpers ──

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
    setStatus("unauthenticated");
  }, []);

  const applyAuth = useCallback((authToken: string, userData: User) => {
    localStorage.setItem(TOKEN_KEY, authToken);
    setToken(authToken);
    setUser(userData);
    setStatus("authenticated");
  }, []);

  const authFetch = useCallback(async (path: string, init?: RequestInit): Promise<Response> => {
    return fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }, []);

  // ── Bootstrap ──

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setStatus("unauthenticated");
      return;
    }

    setToken(stored);
    authFetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("Session expired");
        const userData: User = await res.json();
        applyAuth(stored, userData);
      })
      .catch(() => clearAuth());
  }, [authFetch, applyAuth, clearAuth]);

  // ── Actions ──

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const res = await authFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Login failed");
      }

      const data: { token: string; user: User } = await res.json();
      applyAuth(data.token, data.user);
    },
    [authFetch, applyAuth],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best-effort
    } finally {
      clearAuth();
    }
  }, [authFetch, clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        status,
        isLoading: status === "loading",
        isAuthenticated: status === "authenticated",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};
