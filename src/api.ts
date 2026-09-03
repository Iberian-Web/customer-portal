// customer-portal/src/api.ts
//
// Typed fetch utility for the Customer Portal.
// All requests automatically include the HTTP-only session cookie.
// The base URL is controlled by VITE_API_URL (empty string in dev so Vite
// proxies /api → http://localhost:3001).

const BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

// ─── Enums (mirror schema.prisma — restaurant schema) ─────────────────────────

export type DishCategory =
  | "ENTRANTE"
  | "PRINCIPAL"
  | "POSTRE"
  | "BEBIDA"
  | "GUARNICION"
  | "TAPA"
  | "MENU_CERRADO";

export type Allergen =
  | "GLUTEN"
  | "CRUSTACEOS"
  | "HUEVOS"
  | "PESCADO"
  | "CACAHUETES"
  | "SOJA"
  | "LACTEOS"
  | "FRUTOS_DE_CASCARA"
  | "APIO"
  | "MOSTAZA"
  | "SESAMO"
  | "SULFITOS"
  | "ALTRAMUCES"
  | "MOLUSCOS";

export type ReservationStatus =
  "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

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
  category: DishCategory;
  allergens: Allergen[];
};

export type Menu = {
  id: number;
  instanceId: number;
  name: string;
  createdAt: string;
  dishes: Dish[];
};

export type Reservation = {
  id: number;
  instanceId: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  reservationDate: string; // ISO 8601 — use new Date(r.reservationDate) to parse
  guests: number;
  notes: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReservationCreate = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  reservationDate: string; // ISO 8601
  guests: number;
  notes?: string;
};

export type ReservationUpdate = Partial<
  ReservationCreate & { status: ReservationStatus }
>;

// ─── Portal endpoints ─────────────────────────────────────────────────────────

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
    data: {
      name: string;
      description: string;
      price: string;
      category: DishCategory;
      allergens?: Allergen[];
    },
  ) =>
    request<Dish>(`/api/menus/${menuId}/dishes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    dishId: number,
    data: Partial<{
      name: string;
      description: string;
      price: string;
      category: DishCategory;
      allergens: Allergen[];
    }>,
  ) =>
    request<Dish>(`/api/dishes/${dishId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (dishId: number) =>
    request<void>(`/api/dishes/${dishId}`, { method: "DELETE" }),
};

// ─── Reservation endpoints ────────────────────────────────────────────────────

export const reservationsApi = {
  // List reservations for an instance. Optionally filter by date (YYYY-MM-DD) or status.
  list: (
    instanceId: number,
    filters?: { date?: string; status?: ReservationStatus },
  ) => {
    const params = new URLSearchParams();
    if (filters?.date) params.set("date", filters.date);
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return request<Reservation[]>(
      `/api/instances/${instanceId}/reservations${qs ? `?${qs}` : ""}`,
    );
  },

  create: (instanceId: number, data: ReservationCreate) =>
    request<Reservation>(`/api/instances/${instanceId}/reservations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (reservationId: number, data: ReservationUpdate) =>
    request<Reservation>(`/api/reservations/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateStatus: (reservationId: number, status: ReservationStatus) =>
    request<Reservation>(`/api/reservations/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  remove: (reservationId: number) =>
    request<void>(`/api/reservations/${reservationId}`, { method: "DELETE" }),
};
