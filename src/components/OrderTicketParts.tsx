// Piezas de tarjeta de pedido compartidas por OrdersManager y KitchenDisplay.
import type { Order, OrderItem } from "../api";
import { Icon } from "./icons";
import ConfirmDialog from "./ConfirmDialog";
import type { NextAction } from "../utils/orderStatus";

/** Cabecera: nº de mesa + metadatos a la izquierda, badge a la derecha
 *  (estado en OrdersManager, tiempo transcurrido en KitchenDisplay). */
export function OrderCardHeader({
  order,
  meta,
  badge,
  badgeClassName,
}: {
  order: Order;
  meta: React.ReactNode;
  badge: React.ReactNode;
  badgeClassName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 leading-none">
          {order.tableNumber}
        </p>
        <p className="text-[11px] text-zinc-500">{meta}</p>
      </div>
      <span
        className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap tabular-nums ${badgeClassName}`}
      >
        {badge}
      </span>
    </div>
  );
}

export function OrderItemsList({ items }: { items: OrderItem[] }) {
  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-baseline gap-2">
          <span className="shrink-0 min-w-7 text-center text-sm font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5">
            {item.quantity}
          </span>
          <span className="min-w-0 flex-1 wrap-break-word text-base text-zinc-800 dark:text-zinc-200 leading-snug">
            {item.dishName}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OrderNotesBox({ notes }: { notes: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-lg px-3 py-2">
      <Icon
        name="warningTriangle"
        className="w-4 h-4 text-red-700 dark:text-red-400 shrink-0 mt-0.5"
        strokeWidth={2}
      />
      <p className="text-sm text-red-800 dark:text-red-300 leading-snug">
        {notes}
      </p>
    </div>
  );
}

/** Botón de avance de estado ("Listo" / "Entregado"). `fullWidth` lo hace
 *  ocupar el resto del ancho junto al total, para la fila superior de la
 *  tarjeta; sin él usa el tamaño compacto de KitchenDisplay. */
export function OrderAdvanceButton({
  action,
  busy,
  onClick,
  fullWidth = false,
}: {
  action: NextAction | undefined;
  busy: boolean;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  if (!action) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`font-bold rounded-lg transition-colors disabled:opacity-50 ${
        fullWidth ? "flex-1 py-2.5 text-sm text-center" : "px-3 py-2 text-xs"
      } ${action.className}`}
    >
      {busy ? "…" : action.label}
    </button>
  );
}

/** Confirmación de cancelar pedido, igual desde gestión de pedidos o cocina. */
export function CancelOrderConfirmDialog({
  order,
  loading,
  onConfirm,
  onCancel,
}: {
  order: Order;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      title="¿Cancelar pedido?"
      message={
        <>
          Se cancelará el pedido de la{" "}
          <span className="text-zinc-700 dark:text-zinc-300 font-medium">
            Mesa {order.tableNumber}
          </span>{" "}
          (#{order.id}). Esta acción no se puede deshacer.
        </>
      }
      confirmLabel="Cancelar pedido"
      cancelLabel="Volver"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
