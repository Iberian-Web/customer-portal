import React, { useState, useEffect, useCallback } from "react";
import type { MyAccess, User } from "../api";
import { AuthContext } from "./authTypes";

const BASE = import.meta.env.VITE_API_URL ?? "";

// authFetch no necesita estado del componente: se saca del provider.
async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

async function loadCurrentUser(): Promise<MyAccess> {
  const res = await authFetch("/api/portal/my-access");
  if (!res.ok) throw new Error("Unable to load current user");

  const data = await res.json();
  return data as MyAccess;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<MyAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = (accessData: MyAccess) => {
    setUser(accessData);
    setAccess(accessData);
  };

  const clearAuth = () => {
    setUser(null);
    setAccess(null);
  };

  // ── Bootstrap: la sesión se restaura mediante la cookie HTTP-only ──
  useEffect(() => {
    authFetch("/api/customer-auth/me")
      .then(async (res) => {
        if (!res.ok) throw new Error("Session expired");
        const session = (await res.json()) as { authenticated?: boolean };
        if (!session.authenticated) throw new Error("Session expired");
        applyAuth(await loadCurrentUser());
      })
      .catch(clearAuth)
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authFetch("/api/customer-auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Login failed");
    }

    const data = (await res.json()) as { authenticated?: boolean };
    if (!data.authenticated) throw new Error("Login failed");
    applyAuth(await loadCurrentUser());
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch("/api/customer-auth/logout", { method: "POST" });
    } catch {
      // best-effort
    } finally {
      clearAuth();
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        access,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
