// customer-portal/src/pages/restaurant/OrdersManager.tsx
import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ordersApi, type Order, type OrderStatus } from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import ConfirmDialog from "../../components/ConfirmDialog";
import { getErrorMessage } from "../../utils/errors";
import { money, toLocalTimeString } from "../../utils/format";
import { STATUS_LABEL, STATUS_STYLES } from "../../utils/orderStatus";

// ─── Config ───────────────────────────────────────────────────────────────────

// Un borde lateral de color por estado, para poder distinguir tarjetas de un
// vistazo aunque estén muy juntas en la rejilla.
const STATUS_ACCENT: Record<OrderStatus, string> = {
  PENDING: "border-l-amber-500/70",
  IN_PROGRESS: "border-l-blue-500/70",
  READY: "border-l-emerald-500/70",
  DELIVERED: "border-l-zinc-300 dark:border-l-zinc-700",
  CANCELLED: "border-l-red-500/50",
};

const ALL_STATUSES = Object.keys(STATUS_LABEL) as OrderStatus[];

/** Próximo estado "natural" del ciclo de vida de un pedido, y la etiqueta del botón. */
const NEXT_STATUS: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string; style: string }>
> = {
  PENDING: {
    next: "IN_PROGRESS",
    label: "Enviar a cocina",
    style: "bg-blue-600 hover:bg-blue-500 text-white",
  },
  IN_PROGRESS: {
    next: "READY",
    label: "Marcar como listo",
    style: "bg-emerald-600 hover:bg-emerald-500 text-white",
  },
  READY: {
    next: "DELIVERED",
    label: "Marcar como entregado",
    style: "bg-teal-600 hover:bg-teal-500 text-white",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ─── Ticket de impresión ────────────────────────────────────────────────────

function printOrderTicket(order: Order) {
  const win = window.open("", "_blank", "width=380,height=600");
  if (!win) return;

  const rows = order.items
    .map(
      (it) => `
        <tr>
          <td style="padding:2px 0;">${it.quantity}×</td>
          <td style="padding:2px 6px;">${it.dishName}</td>
          <td style="padding:2px 0;text-align:right;">${(it.quantity * it.unitPrice).toFixed(2)} €</td>
        </tr>`,
    )
    .join("");

  win.document.write(`
    <html>
      <head>
        <title>Pedido #${order.id}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; color: #111; }
          h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
          p { margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .divider { border-top: 1px dashed #999; margin: 10px 0; }
          .total { font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>Pedido #${order.id}</h1>
        <p style="text-align:center;">Mesa ${order.tableNumber} · ${order.waiterName}</p>
        <p style="text-align:center;">${new Date(order.createdAt).toLocaleString("es-ES")}</p>
        <div class="divider"></div>
        <table>${rows}</table>
        <div class="divider"></div>
        <p class="total" style="text-align:right;">TOTAL: ${order.total.toFixed(2)} €</p>
        ${order.notes ? `<div class="divider"></div><p>Notas: ${order.notes}</p>` : ""}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

// ─── Tarjeta de pedido ────────────────────────────────────────────────────────

function OrderCard({
  order,
  updating,
  onAdvance,
  onCancel,
  onEdit,
  onPrint,
  onDelete,
}: {
  order: Order;
  updating: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const nextAction = NEXT_STATUS[order.status];
  const canCancel = !["DELIVERED", "CANCELLED"].includes(order.status);

  return (
    <div
      className={`flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 ${STATUS_ACCENT[order.status]} rounded-2xl p-5 gap-3`}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 leading-none">
            {order.tableNumber}
          </p>
          <p className="text-xs text-zinc-500 mt-1.5">
            #{order.id} · {order.waiterName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[order.status]}`}
          >
            {STATUS_LABEL[order.status]}
          </span>
          <span className="text-xs text-zinc-600 tabular-nums">
            {toLocalTimeString(order.createdAt)}
          </span>
        </div>
      </div>

      {/* Platos */}
      <div className="space-y-1 border-t border-zinc-200 dark:border-zinc-800 pt-3 flex-1">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-baseline gap-2 text-sm">
            <span className="text-zinc-500 shrink-0">{item.quantity}×</span>
            <span className="text-zinc-700 dark:text-zinc-300 truncate">
              {item.dishName}
            </span>
          </div>
        ))}
      </div>

      {/* Notas */}
      {order.notes && (
        <p className="text-xs text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-2.5 py-1.5 leading-snug">
          {order.notes}
        </p>
      )}

      {/* Total */}
      <div className="flex items-center justify-between text-sm font-medium border-t border-zinc-200 dark:border-zinc-800 pt-3">
        <span className="text-zinc-600 dark:text-zinc-400">Total</span>
        <span className="text-zinc-900 dark:text-zinc-100 tabular-nums">
          {money(order.total)}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2">
        {nextAction && (
          <button
            disabled={updating}
            onClick={onAdvance}
            className={`flex-1 px-3 py-3 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 ${nextAction.style}`}
          >
            {nextAction.label}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onEdit}
            title="Editar pedido"
            className="p-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
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
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
              />
            </svg>
          </button>
          <button
            onClick={onPrint}
            title="Imprimir ticket"
            className="p-3 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
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
                d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659"
              />
            </svg>
          </button>
          {canCancel && (
            <button
              disabled={updating}
              onClick={onCancel}
              title="Cancelar pedido"
              className="p-3 text-zinc-500 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-400/10 rounded-xl transition-colors disabled:opacity-50"
            >
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
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </button>
          )}
          <button
            onClick={onDelete}
            title="Eliminar pedido"
            className="p-3 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-xl transition-colors"
          >
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
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 01-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
          </button>
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
  const slug = instance?.slug ?? "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<OrderStatus | "Todos">(
    "Todos",
  );

  // Status update / delete in progress
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Confirmaciones pendientes (cancelar / eliminar), en vez de window.confirm()
  const [cancelConfirm, setCancelConfirm] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ordersApi.list(id);
      setOrders(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Error al cargar los pedidos"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Filtering ─────────────────────────────────────────────────────────────

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
          activeStatus === "Todos" || o.status === activeStatus;
        return matchesSearch && matchesStatus;
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, search, activeStatus]);

  const todayOrders = useMemo(
    () => orders.filter((o) => isToday(o.createdAt)),
    [orders],
  );

  const stats = useMemo(
    () => ({
      inKitchen: orders.filter((o) => o.status === "IN_PROGRESS").length,
      ready: orders.filter((o) => o.status === "READY").length,
      pending: orders.filter((o) => o.status === "PENDING").length,
      revenueToday: todayOrders
        .filter((o) => o.status === "DELIVERED")
        .reduce((sum, o) => sum + o.total, 0),
    }),
    [orders, todayOrders],
  );

  const activeCount = orders.filter((o) =>
    ["PENDING", "IN_PROGRESS", "READY"].includes(o.status),
  ).length;

  // ── Status update ─────────────────────────────────────────────────────────

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    setUpdatingId(order.id);
    try {
      const updated = await ordersApi.updateStatus(order.id, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al actualizar el estado del pedido"));
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────

  const handleCancelConfirmed = async () => {
    if (!cancelConfirm) return;
    setUpdatingId(cancelConfirm.id);
    try {
      const updated = await ordersApi.updateStatus(
        cancelConfirm.id,
        "CANCELLED",
      );
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setCancelConfirm(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al cancelar el pedido"));
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await ordersApi.remove(deleteConfirm.id);
      setOrders((prev) => prev.filter((o) => o.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al eliminar el pedido"));
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="px-6 lg:px-8 py-6 w-full">
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-700 dark:text-red-400">
          {error}
          <button onClick={load} className="ml-4 underline hover:no-underline">
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
            {activeCount} pedidos activos · hoy
          </p>
        </div>
        <button
          onClick={() => navigate(`/restaurant/${slug}/orders/new`)}
          className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-base font-bold rounded-xl transition-colors"
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Nuevo pedido
        </button>
      </div>

      {/* Barra de estadísticas */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-6">
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
          {
            label: "Pendientes",
            value: stats.pending,
            color: "text-amber-700 dark:text-amber-400",
          },
          {
            label: "Facturado hoy",
            value: money(stats.revenueToday),
            color: "text-teal-700 dark:text-teal-400",
          },
        ].map(({ label, value, color }, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 ${i > 0 ? "border-l border-zinc-200 dark:border-zinc-800 pl-8" : ""}`}
          >
            <span className={`text-xl font-bold tabular-nums ${color}`}>
              {loading ? (
                <span className="w-8 h-5 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse inline-block" />
              ) : (
                value
              )}
            </span>
            <span className="text-xs text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-72">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            placeholder="Buscar por mesa, camarero, plato o nº de pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["Todos", ...ALL_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                activeStatus === s
                  ? "bg-teal-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {s === "Todos" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Rejilla de pedidos */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              updating={updatingId === order.id}
              onAdvance={() => {
                const next = NEXT_STATUS[order.status];
                if (next) void handleStatusChange(order, next.next);
              }}
              onCancel={() => setCancelConfirm(order)}
              onEdit={() => navigate(`/restaurant/${slug}/orders/${order.id}`)}
              onPrint={() => printOrderTicket(order)}
              onDelete={() => setDeleteConfirm(order)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-16 text-center text-zinc-500 text-sm">
          {search
            ? `No se encontraron pedidos para «${search}».`
            : "No hay pedidos aún."}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-4">
        {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        {activeStatus !== "Todos" && (
          <span className="ml-2 text-teal-700/70 dark:text-teal-500/60">
            · filtrado por {STATUS_LABEL[activeStatus as OrderStatus]}
          </span>
        )}
      </p>

      {cancelConfirm && (
        <ConfirmDialog
          title="¿Cancelar pedido?"
          message={
            <>
              Se cancelará el pedido de la{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                Mesa {cancelConfirm.tableNumber}
              </span>{" "}
              (#{cancelConfirm.id}). Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Cancelar pedido"
          cancelLabel="Volver"
          loading={updatingId === cancelConfirm.id}
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
          confirmLabel="Eliminar pedido"
          loading={deleting}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
