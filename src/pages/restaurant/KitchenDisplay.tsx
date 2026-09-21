// customer-portal/src/pages/restaurant/KitchenDisplay.tsx
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { ordersApi, type Order, type OrderStatus } from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import { Icon } from "../../components/icons";
import { getErrorMessage } from "../../utils/errors";
import { NEXT_ACTION } from "../../utils/orderStatus";
import {
  OrderCardHeader,
  OrderItemsList,
  OrderNotesBox,
  OrderAdvanceButton,
  CancelOrderConfirmDialog,
} from "../../components/OrderTicketParts";

// ─── Config ───────────────────────────────────────────────────────────────────

// Refresca la lista de pedidos cada X ms (varios dispositivos pueden crear pedidos)
const POLL_INTERVAL_MS = 5000;
// Recalcula el tiempo transcurrido de cada ticket cada X ms
const CLOCK_TICK_MS = 15000;
// Cuánto tiempo se resalta un pedido recién llegado a "Nuevos"
const NEW_ORDER_HIGHLIGHT_MS = 10000;

type ColumnKey = "KITCHEN" | "READY";

type Column = {
  key: ColumnKey;
  statuses: OrderStatus[];
  title: string;
  emptyLabel: string;
  accent: string; // color de la barra superior de la columna
  span: string; // ancho de la columna dentro de la rejilla de 4 columnas
  grid: string; // clases de layout (columns-*) de los tickets dentro de esta columna
};

const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "IN_PROGRESS", "READY"];

const COLUMNS: Column[] = [
  {
    key: "KITCHEN",
    statuses: ["PENDING", "IN_PROGRESS"],
    title: "En cocina",
    emptyLabel: "No hay comandas en cocina",
    accent: "bg-blue-500",
    span: "md:col-span-3",
    // Ocupa 3/4 del ancho. Layout de columnas tipo mampostería/masonry (en
    // vez de un grid clásico): cada ticket ocupa solo el alto que necesita,
    // así un pedido de 1 plato no deja el mismo hueco vacío que uno de 20.
    grid: "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 min-[1920px]:columns-6 min-[2560px]:columns-8",
  },
  {
    key: "READY",
    statuses: ["READY"],
    title: "Listo",
    emptyLabel: "Nada listo todavía",
    accent: "bg-emerald-500",
    span: "md:col-span-1",
    // Ocupa solo 1/4 del ancho: con una columna de tickets es suficiente.
    grid: "grid-cols-1",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function elapsedMinutes(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}min`;
}

/** Cuanto más lleva esperando un ticket, más urgente su color. */
function urgencyClasses(minutes: number): string {
  if (minutes >= 15)
    return "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/30";
  if (minutes >= 8)
    return "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/30";
  return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-700";
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

function OrderTicket({
  order,
  now,
  isNew,
  busy,
  onAdvance,
  onCancel,
}: {
  order: Order;
  now: number;
  isNew: boolean;
  busy: boolean;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const minutes = elapsedMinutes(order.createdAt, now);
  const action = NEXT_ACTION[order.status];

  return (
    <div
      className={`break-inside-avoid mb-3 relative rounded-2xl border bg-white dark:bg-zinc-900 p-4 flex flex-col gap-2.5 ${
        isNew
          ? "border-amber-300 dark:border-amber-400/60"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {/* Solo el borde parpadea para avisar de que es un pedido nuevo: si
          animásemos toda la tarjeta (opacidad/sombra), el parpadeo dificulta
          leer los platos justo cuando más urge leerlos. Esta capa va encima,
          sin bloquear clics, y no afecta al contenido de debajo. */}
      {isNew && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-2xl border-2 border-amber-400 dark:border-amber-400/70 animate-pulse"
        />
      )}
      {/* Cabecera del ticket: mesa + tiempo */}
      <OrderCardHeader
        order={order}
        meta={
          <>
            #{order.id} · {order.waiterName}
          </>
        }
        badge={formatElapsed(minutes)}
        badgeClassName={urgencyClasses(minutes)}
      />

      {/* Platos */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
        <OrderItemsList items={order.items} />
      </div>

      {/* Notas / alergias */}
      {order.notes && <OrderNotesBox notes={order.notes} />}

      {/* Acciones: el botón principal ya no ocupa toda la fila ni tiene
          un tamaño enorme — el mismo tamaño compacto que en OrdersManager. */}
      <div className="flex items-center gap-1 pt-1">
        <OrderAdvanceButton action={action} busy={busy} onClick={onAdvance} />
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          title="Cancelar pedido"
          className="ml-auto shrink-0 p-2 rounded-lg text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          <Icon name="close" className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KitchenDisplay() {
  const instance = useRestaurantInstance();
  const id = instance?.id ?? 0;
  const queryClient = useQueryClient();

  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [cancelConfirm, setCancelConfirm] = useState<Order | null>(null);
  // Columna "Listo" minimizada: se reduce a una barra lateral que solo
  // muestra el número de mesa de cada pedido listo, para dejar más sitio
  // a "En cocina" cuando no hace falta ver el detalle de los pedidos listos.
  const [readyCollapsed, setReadyCollapsed] = useState(false);

  const knownIds = useRef<Set<number> | null>(null);

  // ── Carga + sondeo periódico (refetchInterval sustituye al setInterval manual) ──
  const {
    data: orders = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["orders", id, "active"],
    queryFn: async () => {
      const data = await ordersApi.list(id);
      return data.filter((o) => ACTIVE_STATUSES.includes(o.status));
    },
    enabled: !!id,
    refetchInterval: POLL_INTERVAL_MS,
  });
  const error = queryError
    ? getErrorMessage(queryError, "Error al cargar los pedidos")
    : null;

  // Detecta pedidos nuevos desde la última carga para resaltarlos
  useEffect(() => {
    if (knownIds.current) {
      const freshIds = orders
        .filter((o) => !knownIds.current!.has(o.id))
        .map((o) => o.id);
      if (freshIds.length > 0) {
        setNewIds((prev) => new Set([...prev, ...freshIds]));
        freshIds.forEach((orderId) => {
          setTimeout(() => {
            setNewIds((prev) => {
              const next = new Set(prev);
              next.delete(orderId);
              return next;
            });
          }, NEW_ORDER_HIGHLIGHT_MS);
        });
      }
    }
    knownIds.current = new Set(orders.map((o) => o.id));
  }, [orders]);

  // ── Reloj / tiempos transcurridos ──
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  // ── Acciones ──
  const statusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: number;
      status: OrderStatus;
    }) => ordersApi.updateStatus(orderId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders", id] });
    },
  });

  const advanceOrder = async (order: Order) => {
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    setBusyId(order.id);
    try {
      await statusMutation.mutateAsync({
        orderId: order.id,
        status: action.next,
      });
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al actualizar el pedido"));
    } finally {
      setBusyId(null);
    }
  };

  const cancelOrder = async (order: Order) => {
    setBusyId(order.id);
    try {
      await statusMutation.mutateAsync({
        orderId: order.id,
        status: "CANCELLED",
      });
      setCancelConfirm(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al cancelar el pedido"));
    } finally {
      setBusyId(null);
    }
  };

  // ── Agrupar por columna (KITCHEN = PENDING + IN_PROGRESS, READY = READY),
  //    más antiguos primero ──
  const byColumn = useMemo(() => {
    const grouped: Record<ColumnKey, Order[]> = { KITCHEN: [], READY: [] };
    for (const order of orders) {
      const column = COLUMNS.find((c) => c.statuses.includes(order.status));
      if (column) grouped[column.key].push(order);
    }
    for (const key of Object.keys(grouped) as ColumnKey[]) {
      grouped[key].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return grouped;
  }, [orders]);

  if (error) {
    return (
      <div className="px-8 py-8">
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
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900">
      {/* Cabecera */}
      <div className="shrink-0 flex items-center justify-between px-6 lg:px-8 py-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Cocina
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {orders.length} pedido{orders.length !== 1 ? "s" : ""} en curso
          </p>
        </div>
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Clock className="w-5 h-5" strokeWidth={1.8} />
          <span className="text-base font-semibold tabular-nums">
            {formatClock(new Date(now))}
          </span>
        </div>
      </div>

      {/* Tablero */}
      <div
        className={`flex-1 overflow-hidden grid grid-cols-1 ${
          readyCollapsed ? "md:grid-cols-[1fr_4rem]" : "md:grid-cols-4"
        } divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800`}
      >
        {(() => {
          const kitchen = COLUMNS[0];
          const kitchenOrders = byColumn[kitchen.key];
          return (
            <div
              className={`flex flex-col min-h-0 ${readyCollapsed ? "" : "md:col-span-3"}`}
            >
              <div className="shrink-0">
                <div className={`h-1 ${kitchen.accent}`} />
                <div className="flex items-center justify-between px-4 py-4">
                  <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                    {kitchen.title}
                  </h2>
                  <span className="text-sm font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2.5 py-0.5 tabular-nums">
                    {kitchenOrders.length}
                  </span>
                </div>
              </div>
              <div
                className={`flex-1 overflow-y-auto px-4 pb-4 ${kitchen.grid} gap-3`}
              >
                {loading ? (
                  [1, 2].map((i) => (
                    <div
                      key={i}
                      className="break-inside-avoid mb-3 h-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl animate-pulse"
                    />
                  ))
                ) : kitchenOrders.length === 0 ? (
                  <p className="text-sm text-zinc-600 text-center py-10">
                    {kitchen.emptyLabel}
                  </p>
                ) : (
                  kitchenOrders.map((order) => (
                    <OrderTicket
                      key={order.id}
                      order={order}
                      now={now}
                      isNew={newIds.has(order.id)}
                      busy={busyId === order.id}
                      onAdvance={() => void advanceOrder(order)}
                      onCancel={() => setCancelConfirm(order)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* Columna "Listo": minimizable a una barra lateral con solo el
            número de mesa de cada pedido, para saber de un vistazo qué
            mesas están listas sin ocupar el espacio de una columna entera. */}
        {(() => {
          const ready = COLUMNS[1];
          const readyOrders = byColumn[ready.key];

          if (readyCollapsed) {
            return (
              <div className="flex flex-col min-h-0 bg-zinc-50 dark:bg-zinc-950/40">
                <div className={`h-1 ${ready.accent}`} />
                <button
                  type="button"
                  onClick={() => setReadyCollapsed(false)}
                  title="Mostrar el detalle de los pedidos listos"
                  className="shrink-0 w-full flex flex-row md:flex-col items-center justify-center gap-2 md:gap-1 px-4 md:px-2 py-2.5 md:py-4 border-b border-zinc-200 dark:border-zinc-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                >
                  <Icon
                    name="chevronLeft"
                    className="w-4 h-4 rotate-90 md:rotate-0"
                    strokeWidth={2}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wide">
                    Listo
                  </span>
                  <span className="text-xs font-bold tabular-nums">
                    {readyOrders.length}
                  </span>
                </button>
                {/* `justify-start` (no `justify-center`): así los números se
                    apilan de arriba hacia abajo desde el principio de la
                    columna, en vez de agruparse centrados a media altura. */}
                <div className="flex-1 overflow-y-auto flex flex-row md:flex-col flex-wrap items-center justify-start gap-1.5 p-2">
                  {readyOrders.map((order) => (
                    <div
                      key={order.id}
                      title={`Mesa ${order.tableNumber} lista`}
                      className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-sm font-black tabular-nums"
                    >
                      {order.tableNumber}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div className="flex flex-col min-h-0 md:col-span-1">
              <div className="shrink-0">
                <div className={`h-1 ${ready.accent}`} />
                <div className="flex items-center justify-between px-4 py-4">
                  <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                    {ready.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2.5 py-0.5 tabular-nums">
                      {readyOrders.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReadyCollapsed(true)}
                      title="Minimizar a barra lateral"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Icon
                        name="chevronRight"
                        className="w-4 h-4"
                        strokeWidth={2}
                      />
                    </button>
                  </div>
                </div>
              </div>
              <div
                className={`flex-1 overflow-y-auto px-4 pb-4 grid ${ready.grid} items-start gap-3 auto-rows-min`}
              >
                {loading ? (
                  [1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl animate-pulse"
                    />
                  ))
                ) : readyOrders.length === 0 ? (
                  <p className="col-span-full text-sm text-zinc-600 text-center py-10">
                    {ready.emptyLabel}
                  </p>
                ) : (
                  readyOrders.map((order) => (
                    <OrderTicket
                      key={order.id}
                      order={order}
                      now={now}
                      isNew={newIds.has(order.id)}
                      busy={busyId === order.id}
                      onAdvance={() => void advanceOrder(order)}
                      onCancel={() => setCancelConfirm(order)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {cancelConfirm && (
        <CancelOrderConfirmDialog
          order={cancelConfirm}
          loading={busyId === cancelConfirm.id}
          onConfirm={() => void cancelOrder(cancelConfirm)}
          onCancel={() => setCancelConfirm(null)}
        />
      )}
    </div>
  );
}
