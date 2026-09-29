// Typed fetch utility for the Customer Portal. Requests include the
// HTTP-only session cookie; base URL comes from VITE_API_URL.

const BASE = import.meta.env.VITE_API_URL ?? "";

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

// Error de API con el status HTTP adjunto: permite a quien llama distinguir
// p. ej. un 409 (conflicto de concurrencia optimista) de otros errores sin
// tener que comparar el texto del mensaje.
export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isConflictError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 409;
}

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
    throw new ApiClientError(
      (body as { error?: string }).error ?? `HTTP ${res.status}`,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Enums (mirror schema.prisma — restaurant schema) ─────────────────────────

// Antes era un enum cerrado; ahora es texto libre para poder crear
// secciones de carta nuevas (p. ej. "Especiales", "Cumpleaños") sin límite.
type DishCategory = string;

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

export type OrderStatus =
  "PENDING" | "IN_PROGRESS" | "READY" | "DELIVERED" | "CANCELLED";

export type TableShape = "RECTANGLE" | "ROUND";

// Estado de ocupación calculado por el backend a partir de la sesión de
// mesa abierta (si la hay) y los pedidos que cuelgan de ella.
export type TableMapStatus = "LIBRE" | "EN_COCINA" | "LISTO" | "PARA_COBRAR";

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  address: string;
  domains: string[];
  status: "ACTIVE" | "INACTIVE" | "PENDING";
};

type Service = {
  id: number;
  applicationId: number;
  name: string;
  description: string;
  price: string;
};

type Application = {
  id: number;
  name: string;
  color: string;
  icon: string;
  services: Service[];
};

type InstanceService = {
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
  // Nombre del camarero/a autenticado (resuelto por el backend a partir de
  // la sesión). Úsalo para asociar pedidos a la persona que ha iniciado
  // sesión sin pedírselo en ningún formulario.
  waiterName: string;
  // IDs de servicio ocultos específicamente para el usuario autenticado
  // (independientemente de si el cliente los tiene activos). El sidebar
  // debe excluirlos aunque `instanceServices` los marque como activos.
  disabledServiceIds: number[];
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

// Sección de la carta (Entrante, Principal...): gestionable — se puede
// crear, renombrar, reordenar (position) y eliminar por restaurante.
export type MenuSection = {
  id: number;
  instanceId: number;
  name: string;
  position: number;
  createdAt: string;
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

type ReservationUpdate = Partial<
  ReservationCreate & { status: ReservationStatus }
>;

export type OrderItem = {
  id: number;
  orderId: number;
  dishName: string;
  quantity: number;
  unitPrice: number;
  // null = todavía no la ha preparado cocina (ver "Añadir a la comanda").
  preparedAt: string | null;
};

export type Order = {
  id: number;
  instanceId: number;
  // Sesión de mesa (sentada de comensales) a la que pertenece este pedido.
  // Varios pedidos de la misma mesa comparten tableSessionId mientras la
  // mesa siga abierta — úsalo para combinarlos en un único ticket/cuenta.
  tableSessionId: number;
  tableNumber: number;
  waiterName: string;
  status: OrderStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  total: number; // calculado en el backend a partir de las líneas del pedido
  // Si no es null, la sesión de mesa de este pedido ya se cerró (cobrada):
  // un pedido "Entregado" con esto a null todavía puede sumar más pedidos a
  // la misma cuenta; uno con la sesión cerrada ya está completado del todo.
  tableSessionClosedAt: string | null;
};

type OrderItemInput = {
  dishName: string;
  quantity: number;
  unitPrice: number;
};

export type OrderCreate = {
  tableNumber: number;
  notes?: string;
  items: OrderItemInput[];
};

// Líneas a sumar a un pedido ya existente (no reemplaza las que ya tenía) —
// usado por "Añadir a la comanda" para no trocear una mesa en varios tickets.
export type OrderAddItems = {
  items: OrderItemInput[];
  notes?: string;
  expectedUpdatedAt?: string;
};

type OrderUpdate = Partial<
  Omit<OrderCreate, "items"> & { status: OrderStatus; items: OrderItemInput[] }
> & {
  // Control de concurrencia optimista: el `updatedAt` que teníamos cuando
  // se cargó el pedido. Si ya no coincide con el actual en el servidor
  // (alguien más lo modificó mientras tanto), la petición se rechaza con
  // 409 en vez de pisar silenciosamente ese cambio — ver getErrorMessage /
  // isConflictError para mostrarlo en la UI.
  expectedUpdatedAt?: string;
};

// Sesión de mesa combinada — todos los pedidos de la misma sentada, con
// sus líneas fusionadas (mismo plato + precio = una sola línea) y el total
// conjunto. Pensada para imprimir la cuenta completa de la mesa.
type TableSession = {
  id: number;
  instanceId: number;
  tableNumber: number;
  waiterName: string;
  openedAt: string;
  closedAt: string | null;
  orders: Order[];
  items: OrderItemInput[];
  notes: string;
  total: number;
};

// Mesa del mapa de mesas (página "Mapa"). posRow/posCol/width/height
// describen su posición y tamaño dentro de la rejilla; el resto de campos
// (status, tableSessionId, waiterName, openOrdersCount, total) los calcula
// el backend a partir de la sesión abierta para esa mesa, no se guardan.
export type RestaurantTable = {
  id: number;
  instanceId: number;
  number: number;
  name: string;
  seats: number;
  shape: TableShape;
  posRow: number;
  posCol: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  status: TableMapStatus;
  tableSessionId: number | null;
  waiterName: string;
  openOrdersCount: number;
  total: number;
};

export type RestaurantTableCreate = {
  number: number;
  name?: string;
  seats?: number;
  shape?: TableShape;
  posRow?: number;
  posCol?: number;
  width?: number;
  height?: number;
};

export type RestaurantTableUpdate = Partial<RestaurantTableCreate> & {
  // Igual que en pedidos: control de concurrencia optimista.
  expectedUpdatedAt?: string;
};

export type AnalyticsPeriod = {
  granularity: "month" | "day";
  month: string; // "2026-09"
  label: string; // "Septiembre 2026"
  from: string; // "2026-09-01"
  to: string; // "2026-09-30"
  isCurrentMonth: boolean;
  earliestMonth: string; // "2026-03" — mes de alta del cliente, límite para ir hacia atrás
};

type AnalyticsSummary = {
  period: AnalyticsPeriod;
  revenue: { total: number; today: number; averageOrderValue: number };
  orders: {
    total: number;
    byStatus: Record<OrderStatus, number>;
    dailySeries: { date: string; orders: number; revenue: number }[];
  };
  topDishes: { name: string; quantity: number; revenue: number }[];
  reservations: {
    total: number;
    byStatus: Record<ReservationStatus, number>;
    upcoming: number;
    totalGuests: number;
    noShowRate: number;
  };
};

// ─── Portal endpoints ─────────────────────────────────────────────────────────

export const portalApi = {
  myAccess: () => request<MyAccess>("/api/portal/my-access"),
};

// ─── Analytics endpoints ──────────────────────────────────────────────────────
// Sin `month` ni `day`, el backend responde con el mes natural en curso.

export const analyticsApi = {
  get: (instanceId: number, filters?: { month?: string; day?: string }) => {
    const params = new URLSearchParams();
    if (filters?.month) params.set("month", filters.month);
    if (filters?.day) params.set("day", filters.day);
    const qs = params.toString();
    return request<AnalyticsSummary>(
      `/api/instances/${instanceId}/analytics${qs ? `?${qs}` : ""}`,
    );
  },
};

/** URL del informe mensual en PDF (se abre en pestaña nueva, no pasa por `request`). */
export const analyticsPdfUrl = (instanceId: number, month: string) =>
  `${BASE}/api/instances/${instanceId}/analytics/pdf?month=${encodeURIComponent(month)}`;

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

// ─── Menu section endpoints ───────────────────────────────────────────────────

export const menuSectionsApi = {
  list: (instanceId: number) =>
    request<MenuSection[]>(`/api/instances/${instanceId}/menu-sections`),

  create: (instanceId: number, name: string) =>
    request<MenuSection>(`/api/instances/${instanceId}/menu-sections`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  update: (
    sectionId: number,
    data: Partial<{ name: string; position: number }>,
  ) =>
    request<MenuSection>(`/api/menu-sections/${sectionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (sectionId: number) =>
    request<void>(`/api/menu-sections/${sectionId}`, { method: "DELETE" }),
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

// ─── Order endpoints ──────────────────────────────────────────────────────────

export type CompletedOrdersPage = {
  orders: Order[];
  nextCursor: number | null;
};

export const ordersApi = {
  // Pedidos "activos" de una instancia (la sesión de su mesa sigue
  // abierta) — optionally filter by status. El histórico de mesas ya
  // cerradas y cobradas NO se incluye aquí: puede crecer sin límite, así
  // que tiene su propio endpoint paginado (ver listCompleted).
  list: (instanceId: number, filters?: { status?: OrderStatus }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return request<Order[]>(
      `/api/instances/${instanceId}/orders${qs ? `?${qs}` : ""}`,
    );
  },

  // Pedidos "completados" (mesa ya cerrada y cobrada), paginados con
  // cursor: pasa el nextCursor de la página anterior para pedir la
  // siguiente. search filtra en el propio servidor (mesa, camarero, plato
  // o nº de pedido) para poder buscar en todo el histórico aunque no esté
  // cargado entero.
  listCompleted: (
    instanceId: number,
    options?: { cursor?: number | null; search?: string; limit?: number },
  ) => {
    const params = new URLSearchParams();
    if (options?.cursor) params.set("cursor", String(options.cursor));
    if (options?.search) params.set("search", options.search);
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return request<CompletedOrdersPage>(
      `/api/instances/${instanceId}/orders/completed${qs ? `?${qs}` : ""}`,
    );
  },

  // Single-order detail — used by the order create/edit page.
  get: (orderId: number) => request<Order>(`/api/orders/${orderId}`),

  create: (instanceId: number, data: OrderCreate) =>
    request<Order>(`/api/instances/${instanceId}/orders`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (orderId: number, data: OrderUpdate) =>
    request<Order>(`/api/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateStatus: (
    orderId: number,
    status: OrderStatus,
    expectedUpdatedAt?: string,
  ) =>
    request<Order>(`/api/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({ status, expectedUpdatedAt }),
    }),

  // Suma platos nuevos a un pedido ya existente (mismo ticket) en vez de
  // reemplazar sus líneas — ver "add-items" en el backend.
  addItems: (orderId: number, data: OrderAddItems) =>
    request<Order>(`/api/orders/${orderId}/add-items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  remove: (orderId: number) =>
    request<void>(`/api/orders/${orderId}`, { method: "DELETE" }),
};

// ─── Table session endpoints ──────────────────────────────────────────────────

export const tableSessionsApi = {
  // Sesión de mesa combinada (todos sus pedidos fusionados) — para
  // imprimir la cuenta completa.
  get: (sessionId: number) =>
    request<TableSession>(`/api/table-sessions/${sessionId}`),

  // Cierra la cuenta de la mesa (cobrado). Falla si aún queda algún
  // pedido de esa mesa en curso.
  close: (sessionId: number) =>
    request<{ id: number; closedAt: string }>(
      `/api/table-sessions/${sessionId}/close`,
      { method: "PATCH" },
    ),
};

// ─── Mapa de mesas ────────────────────────────────────────────────────────────

export const tablesApi = {
  list: (instanceId: number) =>
    request<RestaurantTable[]>(`/api/instances/${instanceId}/tables`),

  create: (instanceId: number, data: RestaurantTableCreate) =>
    request<RestaurantTable>(`/api/instances/${instanceId}/tables`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (tableId: number, data: RestaurantTableUpdate) =>
    request<RestaurantTable>(`/api/tables/${tableId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (tableId: number) =>
    request<void>(`/api/tables/${tableId}`, { method: "DELETE" }),
};

// ─── Histórico de auditoría ───────────────────────────────────────────────────
// Quién canceló/eliminó un pedido, cerró una mesa o eliminó una mesa del
// mapa, y cuándo — ver AuditLog en el backend.

export type AuditLogAction =
  | "ORDER_CANCELLED"
  | "ORDER_DELETED"
  | "TABLE_SESSION_CLOSED"
  | "TABLE_DELETED";

export type AuditLogEntry = {
  id: number;
  instanceId: number;
  action: AuditLogAction;
  actorName: string;
  tableNumber: number | null;
  summary: string;
  createdAt: string;
};

export const auditLogApi = {
  list: (instanceId: number, filters?: { tableNumber?: number }) => {
    const params = new URLSearchParams();
    if (filters?.tableNumber !== undefined) {
      params.set("tableNumber", String(filters.tableNumber));
    }
    const qs = params.toString();
    return request<AuditLogEntry[]>(
      `/api/instances/${instanceId}/audit-log${qs ? `?${qs}` : ""}`,
    );
  },
};

// ─── Notificaciones en tiempo real (SSE) ───────────────────────────────────────
// Sustituye/complementa al polling: el backend avisa por Server-Sent Events
// cuando cambia algo (pedido, mesa...) de la instancia. No lleva el dato
// completo — el consumidor reacciona invalidando/recargando su propia
// query. Devuelve una función para cerrar la conexión.

export type RealtimeEvent = {
  type: "order" | "table" | "table-session";
} & Record<string, unknown>;

export function subscribeToInstanceEvents(
  instanceId: number,
  onEvent: (event: RealtimeEvent) => void,
): () => void {
  const source = new EventSource(`${BASE}/api/instances/${instanceId}/events`, {
    withCredentials: true,
  });
  source.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data) as RealtimeEvent);
    } catch {
      // Mensaje no-JSON (p. ej. un comentario de keep-alive): se ignora.
    }
  };
  // Sin manejo especial de onerror: EventSource reintenta la conexión solo
  // (backoff nativo del navegador), y el polling de red por detrás sigue
  // sirviendo de red de seguridad mientras tanto.
  return () => source.close();
}
