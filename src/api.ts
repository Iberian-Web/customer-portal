// client-portal/src/api.ts
//
// Typed fetch utility for the Client Portal.
// All requests automatically inject the stored Bearer token.
// The base URL is controlled by API_URL (empty string in dev so Vite
// proxies /api → http://localhost:3001).

const BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "authToken";

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  address: string;
  domains: string[];
  status: "ACTIVE" | "INACTIVE" | "PENDING";
};

export type Service = {
  id: number;
  applicationId: number;
  name: string;
  description: string;
  price: string;
};

export type Application = {
  id: number;
  name: string;
  color: string;
  icon: string;
  services: Service[];
};

export type InstanceService = {
  id: number;
  instanceId: number;
  serviceId: number;
  active: boolean;
  priceOverride: string;
  service: Service;
};

export type Instance = {
  id: number;
  userId: string;
  applicationId: number;
  contractDate: string;
  lastPaymentDate: string | null;
  application: Application;
  instanceServices: InstanceService[];
};

// Shape returned by GET /api/portal/my-access
export type MyAccess = User & {
  instances: Instance[];
};

export type Dish = {
  id: number;
  menuId: number;
  name: string;
  description: string;
  price: string;
  category: string;
};

export type Menu = {
  id: number;
  instanceId: number;
  name: string;
  createdAt: string;
  dishes: Dish[];
};

// ─── Portal endpoints ─────────────────────────────────────────────────────────

// Returns the full user profile + active instances used to build the sidebar.
export const portalApi = {
  myAccess: () => request<MyAccess>("/api/portal/my-access"),
};

// ─── Menu endpoints ───────────────────────────────────────────────────────────

export const menusApi = {
  list: (instanceId: number) =>
    request<Menu[]>(`/api/instances/${instanceId}/menus`),

  create: (instanceId: number, name: string) =>
    request<Menu>(`/api/instances/${instanceId}/menus`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  update: (menuId: number, name: string) =>
    request<Menu>(`/api/menus/${menuId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),

  remove: (menuId: number) =>
    request<void>(`/api/menus/${menuId}`, { method: "DELETE" }),
};

// ─── Dish endpoints ───────────────────────────────────────────────────────────

export const dishesApi = {
  create: (
    menuId: number,
    data: { name: string; description: string; price: string; category: string },
  ) =>
    request<Dish>(`/api/menus/${menuId}/dishes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    dishId: number,
    data: Partial<{ name: string; description: string; price: string; category: string }>,
  ) =>
    request<Dish>(`/api/dishes/${dishId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (dishId: number) =>
    request<void>(`/api/dishes/${dishId}`, { method: "DELETE" }),
};
