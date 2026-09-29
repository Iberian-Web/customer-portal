// customer-portal/src/pages/restaurant/OrdersManager.tsx
import { useState, useMemo, useEffect } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import {
  Pencil,
  Printer,
  XCircle,
  Trash2,
  Plus,
  Search,
  RotateCcw,
  Receipt,
  Filter,
  ChevronDown,
} from "lucide-react";
import {
  ordersApi,
  tableSessionsApi,
  isConflictError,
  type Order,
  type OrderStatus,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import { useInstanceEvents } from "../../hooks/useInstanceEvents";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Spinner } from "../../components/icons";
import { getErrorMessage } from "../../utils/errors";
import { money, toLocalTimeString } from "../../utils/format";
import {
  STATUS_LABEL,
  STATUS_STYLES,
  NEXT_ACTION,
  COMPLETED_LABEL,
  COMPLETED_STYLE,
} from "../../utils/orderStatus";
import { printOrderTicket } from "../../utils/printTicket";
import {
  OrderCardHeader,
  OrderItemsList,
  OrderNotesBox,
  OrderAdvanceButton,
  CancelOrderConfirmDialog,
} from "../../components/OrderTicketParts";

// ─── Config ───────────────────────────────────────────────────────────────────

// Borde lateral de color por estado, para distinguir tarjetas de un vistazo.
const STATUS_ACCENT: Partial<Record<OrderStatus, string>> = {
  IN_PROGRESS: "border-l-blue-500/70",
  READY: "border-l-emerald-500/70",
  DELIVERED: "border-l-zinc-300 dark:border-l-zinc-700",
  CANCELLED: "border-l-red-500/50",
};

// PENDING ya no existe como paso intermedio, así que no se ofrece como filtro.
const ALL_STATUSES: OrderStatus[] = [
  "IN_PROGRESS",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

// Mismo número de columnas para el esqueleto de carga y para el layout
// real (masonry), reutilizados tanto en activos como en completados.
const SKELETON_GRID_CLASSES =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1920px]:grid-cols-6 min-[2560px]:grid-cols-7 gap-3";
const MASONRY_CLASSES =
  "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 min-[1920px]:columns-6 min-[2560px]:columns-7 gap-3";

// ─── Tarjeta de pedido ────────────────────────────────────────────────────────

function OrderCard({
  order,
  updating,
  closingTable,
  sessionStillActive,
  onAdvance,
  onCancel,
  onEdit,
  onReorder,
  onCloseTable,
  onPrint,
  onDelete,
}: {
  order: Order;
  updating: boolean;
  closingTable: boolean;
  sessionStillActive: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onReorder: () => void;
  onCloseTable: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const nextAction = NEXT_ACTION[order.status];
  // Entregado/cancelado = comanda cerrada: no se toca, se pide de nuevo (onReorder).
  const isClosed = ["DELIVERED", "CANCELLED"].includes(order.status);
  const canCancel = !isClosed;
  // Sesión cerrada (cobrada) = ya no admite ni nuevos pedidos ni volver a cerrarla.
  const sessionClosed = order.tableSessionClosedAt !== null;
  const showCompleted = order.status === "DELIVERED" && sessionClosed;
  const actionBtn =
    "p-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none";
  // Mientras queda algo por avanzar (Listo/Entregado) esa es la acción
  // principal; una vez la comanda está cerrada, el hueco lo ocupa "Cerrar y
  // cobrar" en su lugar — así no compite por espacio con un icono más.
  const canClose = isClosed && !sessionClosed;
  const primaryAction = nextAction ? (
    <OrderAdvanceButton
      action={nextAction}
      busy={updating}
      onClick={onAdvance}
      fullWidth
    />
  ) : canClose ? (
    <button
      type="button"
      disabled={closingTable || sessionStillActive}
      onClick={onCloseTable}
      title={
        sessionStillActive
          ? "Todavía hay otro pedido en curso en esta mesa"
          : "Cerrar y cobrar la cuenta combinada"
      }
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold rounded-lg transition-colors bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white"
    >
      <Receipt className="w-4 h-4" strokeWidth={2} />
      Cerrar y cobrar
    </button>
  ) : null;

  return (
    <div
      className={`break-inside-avoid mb-3 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 ${STATUS_ACCENT[order.status] ?? "border-l-zinc-300 dark:border-l-zinc-700"} rounded-2xl p-4 gap-2.5`}
    >
      <OrderCardHeader
        order={order}
        meta={
          <>
            #{order.id} · {order.waiterName} ·{" "}
            {toLocalTimeString(order.createdAt)}
          </>
        }
        badge={showCompleted ? COMPLETED_LABEL : STATUS_LABEL[order.status]}
        badgeClassName={
          showCompleted ? COMPLETED_STYLE : STATUS_STYLES[order.status]
        }
      />

      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2.5 flex-1">
        <OrderItemsList items={order.items} />
      </div>

      {order.notes && <OrderNotesBox notes={order.notes} />}

      {/* Fila 1: total + acción principal (avanzar estado, o "Cerrar y
          cobrar" una vez no queda nada más que avanzar) a todo lo ancho, más
          un ">" que despliega el resto de acciones debajo. Ese panel, en
          conjunto alineado a la derecha, mantiene el mismo orden interno:
          negativo (izq.) → auxiliar (centro) → positivo (der.). */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">
            {money(order.total)}
          </span>
          {primaryAction}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Ocultar más acciones" : "Más acciones"}
            title={expanded ? "Ocultar más acciones" : "Más acciones"}
            className={`shrink-0 p-2.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${primaryAction ? "" : "ml-auto"}`}
          >
            <ChevronDown
              className={`w-4.5 h-4.5 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
              strokeWidth={1.8}
            />
          </button>
        </div>

        {/* Truco `grid-rows` para animar de 0 a la altura real sin medirla
            a mano: transiciona la fila del grid, no un max-height fijo. */}
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${expanded ? "grid-rows-[1fr] mt-2" : "grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            <div className="flex items-center justify-end gap-1">
              {canCancel && (
                <button
                  disabled={updating}
                  onClick={onCancel}
                  title="Cancelar pedido"
                  aria-label="Cancelar pedido"
                  className={`${actionBtn} text-zinc-500 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-400/10`}
                >
                  <XCircle className="w-4.5 h-4.5" strokeWidth={1.8} />
                </button>
              )}
              <button
                onClick={onDelete}
                title="Eliminar"
                aria-label="Eliminar"
                className={`${actionBtn} text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10`}
              >
                <Trash2 className="w-4.5 h-4.5" strokeWidth={1.8} />
              </button>
              {!isClosed && (
                <button
                  onClick={onEdit}
                  title="Editar pedido"
                  aria-label="Editar pedido"
                  className={`${actionBtn} text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800`}
                >
                  <Pencil className="w-4.5 h-4.5" strokeWidth={1.8} />
                </button>
              )}
              <button
                onClick={onPrint}
                title="Imprimir ticket"
                aria-label="Imprimir ticket"
                className={`${actionBtn} text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800`}
              >
                <Printer className="w-4.5 h-4.5" strokeWidth={1.8} />
              </button>
              {isClosed && (
                <button
                  onClick={onReorder}
                  title={`Nuevo pedido para la mesa ${order.tableNumber}`}
                  aria-label={`Nuevo pedido para la mesa ${order.tableNumber}`}
                  className={`${actionBtn} text-zinc-500 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10`}
                >
                  <RotateCcw className="w-4.5 h-4.5" strokeWidth={1.8} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersManager() {
  const navigate = useNavigate();
  const instance = useRestaurantInstance();
  const id = instance?.id ?? 0;
  const { access } = useAuth();
  const restaurantName = access?.company || access?.name;
  const slug = instance?.slug ?? "";
  const queryClient = useQueryClient();

  // UI state
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<
    OrderStatus | "Todos" | "Completados"
  >("Todos");
  // Aparte del filtro de arriba, un interruptor propio para no cargar (ni
  // mostrar) los completados salvo que se pidan explícitamente — pueden ser
  // muchísimos con el tiempo y no siempre hacen falta.
  const [showCompleted, setShowCompleted] = useState(false);
  const viewingCompletedOnly = activeStatus === "Completados";
  const completedSectionVisible = showCompleted || viewingCompletedOnly;

  // La búsqueda de completados va al servidor (ver el useInfiniteQuery más
  // abajo), así que se debounça para no lanzar una petición por cada letra.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Confirmaciones pendientes (cancelar / eliminar / cerrar mesa), en vez
  // de window.confirm()
  const [cancelConfirm, setCancelConfirm] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);
  const [closeTableConfirm, setCloseTableConfirm] = useState<Order | null>(
    null,
  );

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // Pedidos activos (mesa todavía abierta): un conjunto siempre acotado, se
  // cargan enteros de una vez. Los completados son harina de otro costal
  // (ver más abajo).

  const {
    data: orders = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => ordersApi.list(id),
    enabled: !!id,
  });
  const error = queryError
    ? getErrorMessage(queryError, "Error al cargar los pedidos")
    : null;

  // Avisos en tiempo real (SSE): en vez de depender solo del polling de
  // abajo, en cuanto cocina/otro camarero cambia algo se refresca al momento.
  useInstanceEvents(id, [["orders", id]]);

  const COMPLETED_PAGE_SIZE = 30;

  // Pedidos completados: pueden ser decenas de miles, así que van
  // paginados con cursor y solo se piden cuando la sección está visible.
  const {
    data: completedPages,
    isLoading: completedLoading,
    isFetchingNextPage: completedFetchingMore,
    fetchNextPage: fetchMoreCompleted,
    hasNextPage: hasMoreCompleted,
    error: completedQueryError,
  } = useInfiniteQuery({
    queryKey: ["orders-completed", id, debouncedSearch],
    queryFn: ({ pageParam }) =>
      ordersApi.listCompleted(id, {
        cursor: pageParam,
        search: debouncedSearch,
        limit: COMPLETED_PAGE_SIZE,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!id && completedSectionVisible,
  });
  const completedOrders = useMemo(
    () => completedPages?.pages.flatMap((p) => p.orders) ?? [],
    [completedPages],
  );
  const completedError = completedQueryError
    ? getErrorMessage(completedQueryError, "Error al cargar los completados")
    : null;

  // ── Filtering ─────────────────────────────────────────────────────────────
  // Ojo: "Completados" no es un OrderStatus real, así que al seleccionarlo
  // ningún pedido activo lo cumple — el efecto es vaciar esta lista y dejar
  // solo la sección de completados, sin necesidad de una rama aparte.

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders
      .filter((o) => {
        const matchesSearch =
          !q ||
          String(o.tableNumber).includes(q) ||
          o.waiterName.toLowerCase().includes(q) ||
          o.items.some((i) => i.dishName.toLowerCase().includes(q)) ||
          String(o.id).includes(q);
        const matchesStatus =
          activeStatus === "Todos" ||
          (activeStatus !== "Completados" && o.status === activeStatus);
        return matchesSearch && matchesStatus;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, search, activeStatus]);

  const stats = useMemo(
    () => ({
      inKitchen: orders.filter((o) => o.status === "IN_PROGRESS").length,
      ready: orders.filter((o) => o.status === "READY").length,
    }),
    [orders],
  );

  const activeCount = orders.filter((o) =>
    ["IN_PROGRESS", "READY"].includes(o.status),
  ).length;

  // Sesiones de mesa con algún pedido en curso: mientras sea así no se
  // pueden cerrar. Se usa para deshabilitar el botón antes de intentarlo.
  const sessionsWithActiveOrders = useMemo(
    () =>
      new Set(
        orders
          .filter((o) => ["IN_PROGRESS", "READY"].includes(o.status))
          .map((o) => o.tableSessionId),
      ),
    [orders],
  );

  // ── Status update ─────────────────────────────────────────────────────────
  // La misma mutation cubre tanto "avanzar de estado" como "cancelar" (ambos
  // son, en el fondo, un cambio de estado); `variables` permite saber qué
  // pedido concreto está en curso sin un estado adicional.

  const statusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
      expectedUpdatedAt,
    }: {
      orderId: number;
      status: OrderStatus;
      expectedUpdatedAt?: string;
    }) => ordersApi.updateStatus(orderId, status, expectedUpdatedAt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders", id] });
      setCancelConfirm(null);
    },
    onError: (e: unknown) => {
      // Conflicto de concurrencia (otra persona lo cambió mientras tanto):
      // se refresca la lista al momento para que se vea el estado real,
      // en vez de dejar la tarjeta desactualizada en pantalla.
      if (isConflictError(e)) {
        void queryClient.invalidateQueries({ queryKey: ["orders", id] });
      }
      alert(getErrorMessage(e, "Error al actualizar el pedido"));
    },
  });

  const handleStatusChange = (order: Order, newStatus: OrderStatus) => {
    statusMutation.mutate({
      orderId: order.id,
      status: newStatus,
      expectedUpdatedAt: order.updatedAt,
    });
  };

  const handleCancelConfirmed = () => {
    if (!cancelConfirm) return;
    statusMutation.mutate({
      orderId: cancelConfirm.id,
      status: "CANCELLED",
      expectedUpdatedAt: cancelConfirm.updatedAt,
    });
  };

  // ── Cerrar mesa (cobrar) ─────────────────────────────────────────────────
  // A partir de ahí, un pedido nuevo para esa mesa abre una sesión nueva.
  // El backend rechaza el cierre si queda algún pedido en curso.

  const closeSessionMutation = useMutation({
    mutationFn: (tableSessionId: number) =>
      tableSessionsApi.close(tableSessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders", id] });
      setCloseTableConfirm(null);
    },
    onError: (e: unknown) =>
      alert(getErrorMessage(e, "Error al cerrar la mesa")),
  });

  const handleCloseTableConfirmed = () => {
    if (closeTableConfirm)
      closeSessionMutation.mutate(closeTableConfirm.tableSessionId);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (orderId: number) => ordersApi.remove(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders", id] });
      setDeleteConfirm(null);
    },
    onError: (e: unknown) =>
      alert(getErrorMessage(e, "Error al eliminar el pedido")),
  });

  const handleDeleteConfirmed = () => {
    if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
  };

  // Un único punto para renderizar una tarjeta de pedido: la usan tanto la
  // rejilla de "activos" como la de "completados", con las mismas acciones.
  const renderOrderCard = (order: Order) => (
    <OrderCard
      key={order.id}
      order={order}
      updating={
        statusMutation.isPending &&
        statusMutation.variables?.orderId === order.id
      }
      closingTable={
        closeSessionMutation.isPending &&
        closeSessionMutation.variables === order.tableSessionId
      }
      sessionStillActive={sessionsWithActiveOrders.has(order.tableSessionId)}
      onAdvance={() => {
        const next = NEXT_ACTION[order.status];
        if (next) handleStatusChange(order, next.next);
      }}
      onCancel={() => setCancelConfirm(order)}
      onEdit={() => navigate(`/restaurant/${slug}/orders/${order.id}`)}
      onReorder={() =>
        navigate(`/restaurant/${slug}/orders/new?table=${order.tableNumber}`)
      }
      onCloseTable={() => setCloseTableConfirm(order)}
      onPrint={() =>
        void printOrderTicket(order, restaurantName, access?.address)
      }
      onDelete={() => setDeleteConfirm(order)}
    />
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error && !viewingCompletedOnly) {
    return (
      <div className="px-6 lg:px-8 py-6 w-full">
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-700 dark:text-red-400">
          {error}
          <button
            onClick={() => void refetch()}
            className="ml-4 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Gestión de pedidos
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {activeCount} pedido{activeCount !== 1 ? "s" : ""} activo
            {activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => navigate(`/restaurant/${slug}/orders/new`)}
          className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-base font-bold rounded-xl transition-colors"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          Pedido
        </button>
      </div>

      {/* Búsqueda + Filtro + Stats en la misma línea en escritorio */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        {/* Barra de búsqueda */}
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
            strokeWidth={2}
          />
          <input
            type="text"
            placeholder="Buscar por mesa, camarero, plato o nº de pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors"
          />
        </div>

        {/* Filtrar por estado (con text-base para igualar la altura del buscador) */}
        <div className="relative shrink-0">
          <Filter
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            strokeWidth={2}
          />
          <select
            value={activeStatus}
            onChange={(e) =>
              setActiveStatus(
                e.target.value as OrderStatus | "Todos" | "Completados",
              )
            }
            title="Filtrar por estado"
            className="w-full lg:w-auto appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-9 py-3 text-base font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors cursor-pointer"
          >
            <option value="Todos">Filtrar por…</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
            <option value="Completados">{COMPLETED_LABEL}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        </div>

        {/* Los completados pueden ser muchísimos con el tiempo: aparte
            (arriba) permite ver solo esos, este interruptor decide si
            además se muestran (paginados) debajo de los activos. */}
        {!viewingCompletedOnly && (
          <label className="flex items-center gap-2 shrink-0 px-1 lg:px-0 py-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-teal-600 focus:ring-teal-500/40 cursor-pointer"
            />
            Mostrar completados
          </label>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 lg:flex lg:items-center gap-2 lg:gap-x-6 lg:shrink-0 lg:px-5 lg:py-3.5 lg:bg-white lg:dark:bg-zinc-900 lg:border lg:border-zinc-200 lg:dark:border-zinc-800 lg:rounded-xl">
          {[
            {
              label: "En cocina",
              value: stats.inKitchen,
              color: "text-blue-700 dark:text-blue-400",
            },
            {
              label: "Listos",
              value: stats.ready,
              color: "text-emerald-700 dark:text-emerald-400",
            },
          ].map(({ label, value, color }, i) => (
            <div
              key={label}
              className={`flex flex-col lg:flex-row items-center lg:items-center gap-0.5 lg:gap-2 bg-white dark:bg-zinc-900 lg:bg-transparent border border-zinc-200 dark:border-zinc-800 lg:border-0 rounded-xl lg:rounded-none px-3 py-2.5 lg:px-0 lg:py-0 ${i > 0 ? "lg:border-l lg:border-zinc-200 lg:dark:border-zinc-800 lg:pl-6" : ""}`}
            >
              <span
                className={`text-lg lg:text-xl font-bold tabular-nums ${color}`}
              >
                {loading ? (
                  <span className="w-8 h-5 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse inline-block" />
                ) : (
                  value
                )}
              </span>
              <span className="text-[11px] lg:text-xs text-zinc-500 text-center lg:text-left leading-tight">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pedidos activos */}
      {!viewingCompletedOnly &&
        (loading ? (
          <div className={SKELETON_GRID_CLASSES}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-16 text-center text-zinc-500 text-sm">
            {search
              ? `No se encontraron pedidos para «${search}».`
              : "No hay pedidos activos."}
          </div>
        ) : (
          // Layout tipo masonry en vez de grid clásico, para que cada
          // tarjeta ocupe solo el alto que necesita sin desperdiciar espacio.
          <div className={MASONRY_CLASSES}>{filtered.map(renderOrderCard)}</div>
        ))}

      {/* Pedidos completados: aparte y paginados — nunca de golpe */}
      {completedSectionVisible && (
        <>
          {!viewingCompletedOnly && (
            <div className="flex items-center gap-3 my-6">
              <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Completados
              </span>
              <hr className="flex-1 border-zinc-200 dark:border-zinc-800" />
            </div>
          )}

          {completedError ? (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-700 dark:text-red-400">
              {completedError}
            </div>
          ) : completedLoading ? (
            <div className={SKELETON_GRID_CLASSES}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : completedOrders.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-16 text-center text-zinc-500 text-sm">
              {debouncedSearch
                ? `No se encontraron pedidos completados para «${debouncedSearch}».`
                : "No hay pedidos completados."}
            </div>
          ) : (
            <>
              <div className={MASONRY_CLASSES}>
                {completedOrders.map(renderOrderCard)}
              </div>
              {hasMoreCompleted && (
                <div className="flex justify-center mt-5">
                  <button
                    onClick={() => void fetchMoreCompleted()}
                    disabled={completedFetchingMore}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {completedFetchingMore && <Spinner />}
                    Cargar más
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <p className="text-xs text-zinc-600 mt-4">
        {viewingCompletedOnly ? (
          <>
            {completedOrders.length} completado
            {completedOrders.length !== 1 ? "s" : ""} cargado
            {completedOrders.length !== 1 ? "s" : ""}
            {hasMoreCompleted && (
              <span className="ml-2 text-teal-700/70 dark:text-teal-500/60">
                · hay más, pulsa "Cargar más"
              </span>
            )}
          </>
        ) : (
          <>
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            {activeStatus !== "Todos" && (
              <span className="ml-2 text-teal-700/70 dark:text-teal-500/60">
                · filtrado por {STATUS_LABEL[activeStatus as OrderStatus]}
              </span>
            )}
          </>
        )}
      </p>

      {cancelConfirm && (
        <CancelOrderConfirmDialog
          order={cancelConfirm}
          loading={
            statusMutation.isPending &&
            statusMutation.variables?.orderId === cancelConfirm.id
          }
          onConfirm={handleCancelConfirmed}
          onCancel={() => setCancelConfirm(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="¿Eliminar pedido?"
          message={
            <>
              Se eliminará el pedido{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                #{deleteConfirm.id} (Mesa {deleteConfirm.tableNumber})
              </span>
              . Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          loading={deleteMutation.isPending}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {closeTableConfirm && (
        <ConfirmDialog
          title="¿Cerrar mesa?"
          message={
            <>
              Se cerrará la cuenta de la{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                Mesa {closeTableConfirm.tableNumber}
              </span>{" "}
              y se combinarán todos sus pedidos en un único ticket. Esta acción
              no se puede deshacer.
            </>
          }
          confirmLabel="Cerrar y cobrar"
          cancelLabel="Volver"
          tone="warning"
          loading={
            closeSessionMutation.isPending &&
            closeSessionMutation.variables === closeTableConfirm.tableSessionId
          }
          onConfirm={handleCloseTableConfirmed}
          onCancel={() => setCloseTableConfirm(null)}
        />
      )}
    </div>
  );
}
