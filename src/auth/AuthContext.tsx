import React, { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalApi, type MyAccess } from "../api";
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

// Restaura la sesión desde la cookie HTTP-only: comprueba que siga siendo
// válida y solo entonces carga los datos del cliente. Cualquier fallo se
// trata como "no autenticado", nunca como error de la query.
async function bootstrapAuth(): Promise<MyAccess | null> {
  try {
    const res = await authFetch("/api/customer-auth/me");
    if (!res.ok) return null;
    const session = (await res.json()) as { authenticated?: boolean };
    if (!session.authenticated) return null;
    return await portalApi.myAccess();
  } catch {
    return null;
  }
}

const AUTH_QUERY_KEY = ["auth", "session"];

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();

  // La sesión solo cambia por un login/logout explícito (ver más abajo), no
  // por un refetch en segundo plano — de ahí el staleTime infinito.
  const { data: access = null, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: bootstrapAuth,
    retry: false,
    staleTime: Infinity,
  });

  const login = useCallback(
    async (username: string, password: string) => {
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
      queryClient.setQueryData(AUTH_QUERY_KEY, await portalApi.myAccess());
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authFetch("/api/customer-auth/logout", { method: "POST" });
    } catch {
      // best-effort
    } finally {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user: access,
        access,
        isLoading,
        isAuthenticated: !!access,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
