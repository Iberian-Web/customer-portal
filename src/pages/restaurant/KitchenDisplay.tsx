// customer-portal/src/pages/restaurant/KitchenDisplay.tsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ordersApi, type Order, type OrderStatus } from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import ConfirmDialog from "../../components/ConfirmDialog";
import { getErrorMessage } from "../../utils/errors";

// ─── Config ───────────────────────────────────────────────────────────────────

// Refresca la lista de pedidos cada X ms (varios dispositivos pueden crear pedidos)
const POLL_INTERVAL_MS = 5000;
// Recalcula el tiempo transcurrido de cada ticket cada X ms
const CLOCK_TICK_MS = 15000;
// Cuánto tiempo se resalta un pedido recién llegado a "Nuevos"
const NEW_ORDER_HIGHLIGHT_MS = 10000;

type Column = {
  status: OrderStatus;
  title: string;
  emptyLabel: string;
  accent: string; // color de la barra superior de la columna
};

// "Nuevos" (PENDING) son pedidos creados pero que todavía NO se han enviado
// a cocina: solo pasan a "En preparación" (IN_PROGRESS) cuando alguien pulsa
// "Enviar a cocina" en el pedido (o "Empezar" aquí mismo). Nunca ocurre de
// forma automática al crear el pedido.
const COLUMNS: Column[] = [
  {
    status: "PENDING",
    title: "Nuevos · sin enviar",
    emptyLabel: "No hay pedidos nuevos",
    accent: "bg-amber-500",
  },
  {
    status: "IN_PROGRESS",
    title: "En preparación",
    emptyLabel: "Nada en preparación",
    accent: "bg-blue-500",
  },
  {
    status: "READY",
    title: "Listos para servir",
    emptyLabel: "Nada listo todavía",
    accent: "bg-emerald-500",
  },
];

/** Botón de acción principal de cada ticket, según su estado actual. */
const NEXT_ACTION: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string; classes: string }>
> = {
  PENDING: {
    next: "IN_PROGRESS",
    label: "Empezar",
    classes: "bg-blue-600 hover:bg-blue-500 text-white",
  },
  IN_PROGRESS: {
    next: "READY",
    label: "Listo",
    classes: "bg-emerald-600 hover:bg-emerald-500 text-white",
  },
  READY: {
    next: "DELIVERED",
    label: "Entregado",
    classes: "bg-teal-600 hover:bg-teal-500 text-white",
  },
};

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
      className={`rounded-2xl border bg-white dark:bg-zinc-900 p-5 flex flex-col gap-3 transition-shadow ${
        isNew
          ? "border-amber-300 dark:border-amber-400/60 shadow-[0_0_0_2px_rgba(251,191,36,0.25)] animate-pulse"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {/* Cabecera del ticket: mesa + tiempo */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 leading-none">
            {order.tableNumber}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            #{order.id} · {order.waiterName}
          </p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${urgencyClasses(minutes)}`}
        >
          {formatElapsed(minutes)}
        </span>
      </div>

      {/* Platos */}
      <div className="space-y-1.5 border-t border-zinc-200 dark:border-zinc-800 pt-3">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-baseline gap-2">
            <span className="shrink-0 min-w-7 text-center text-sm font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5">
              {item.quantity}
            </span>
            <span className="text-base text-zinc-800 dark:text-zinc-200 leading-snug">
              {item.dishName}
            </span>
          </div>
        ))}
      </div>

      {/* Notas / alergias */}
      {order.notes && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-lg px-3 py-2">
          <svg
            className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <p className="text-sm text-red-800 dark:text-red-300 leading-snug">
            {order.notes}
          </p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2 pt-1">
        {action && (
          <button
            type="button"
            disabled={busy}
            onClick={onAdvance}
            className={`flex-1 py-4 rounded-xl text-base font-bold transition-colors disabled:opacity-50 ${action.classes}`}
          >
            {busy ? "…" : action.label}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          title="Cancelar pedido"
          className="shrink-0 p-4 rounded-xl text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KitchenDisplay() {
  const instance = useRestaurantInstance();
  const id = instance?.id ?? 0;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [cancelConfirm, setCancelConfirm] = useState<Order | null>(null);

  const knownIds = useRef<Set<number> | null>(null);

  // ── Carga + sondeo periódico ──
  const load = useCallback(
    async (isFirstLoad: boolean) => {
      if (isFirstLoad) setLoading(true);
      try {
        const data = await ordersApi.list(id);
        const active = data.filter((o) =>
          (["PENDING", "IN_PROGRESS", "READY"] as OrderStatus[]).includes(
            o.status,
          ),
        );
        setOrders(active);
        setError(null);

        // Detecta pedidos nuevos desde la última carga para resaltarlos
        if (knownIds.current) {
          const freshIds = active
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
        knownIds.current = new Set(active.map((o) => o.id));
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Error al cargar los pedidos"));
      } finally {
        if (isFirstLoad) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load(true);
    const poll = setInterval(() => void load(false), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [load]);

  // ── Reloj / tiempos transcurridos ──
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  // ── Acciones ──
  const advanceOrder = async (order: Order) => {
    const action = NEXT_ACTION[order.status];
    if (!action) return;
    setBusyId(order.id);
    try {
      const updated = await ordersApi.updateStatus(order.id, action.next);
      setOrders((prev) =>
        updated.status === "DELIVERED"
          ? prev.filter((o) => o.id !== order.id)
          : prev.map((o) => (o.id === updated.id ? updated : o)),
      );
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al actualizar el pedido"));
    } finally {
      setBusyId(null);
    }
  };

  const cancelOrder = async (order: Order) => {
    setBusyId(order.id);
    try {
      await ordersApi.updateStatus(order.id, "CANCELLED");
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setCancelConfirm(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al cancelar el pedido"));
    } finally {
      setBusyId(null);
    }
  };

  // ── Agrupar por columna, más antiguos primero ──
  const byStatus = useMemo(() => {
    const grouped: Record<OrderStatus, Order[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      READY: [],
      DELIVERED: [],
      CANCELLED: [],
    };
    for (const order of orders) grouped[order.status].push(order);
    for (const status of Object.keys(grouped) as OrderStatus[]) {
      grouped[status].sort(
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
            onClick={() => void load(true)}
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
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-base font-semibold tabular-nums">
            {formatClock(new Date(now))}
          </span>
        </div>
      </div>

      {/* Tablero */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
        {COLUMNS.map((column) => {
          const columnOrders = byStatus[column.status];
          return (
            <div key={column.status} className="flex flex-col min-h-0">
              {/* Cabecera de columna */}
              <div className="shrink-0">
                <div className={`h-1 ${column.accent}`} />
                <div className="flex items-center justify-between px-4 py-4">
                  <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                    {column.title}
                  </h2>
                  <span className="text-sm font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2.5 py-0.5 tabular-nums">
                    {columnOrders.length}
                  </span>
                </div>
              </div>

              {/* Tickets */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
                {loading ? (
                  [1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-40 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl animate-pulse"
                    />
                  ))
                ) : columnOrders.length === 0 ? (
                  <p className="text-sm text-zinc-600 text-center py-10">
                    {column.emptyLabel}
                  </p>
                ) : (
                  columnOrders.map((order) => (
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
        })}
      </div>

      {cancelConfirm && (
        <ConfirmDialog
          title="¿Cancelar pedido?"
          message={
            <>
              Se cancelará el pedido de la{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                Mesa {cancelConfirm.tableNumber}
              </span>
              . Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Cancelar pedido"
          cancelLabel="Volver"
          loading={busyId === cancelConfirm.id}
          onConfirm={() => void cancelOrder(cancelConfirm)}
          onCancel={() => setCancelConfirm(null)}
        />
      )}
    </div>
  );
}
