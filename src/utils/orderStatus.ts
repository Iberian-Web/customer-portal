import type { OrderStatus } from "../api";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Nuevo · sin enviar",
  IN_PROGRESS: "En cocina",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING:
    "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20",
  IN_PROGRESS:
    "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/20",
  READY:
    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20",
  DELIVERED:
    "bg-zinc-100 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600/30",
  CANCELLED:
    "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20",
};

// Estado derivado (no existe en el backend): un pedido "Entregado" cuya
// mesa ya se cerró y cobró. A diferencia de "Entregado" a secas, aquí ya no
// se le puede añadir nada más a la cuenta — se muestra más apagado para que
// se distinga de un vistazo del resto.
export const COMPLETED_LABEL = "Completado";
export const COMPLETED_STYLE =
  "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 ring-1 ring-zinc-200 dark:ring-zinc-700/40";

// ─── Próximo estado del ciclo de vida de un pedido ─────────────────────────
// Compartido entre OrdersManager y KitchenDisplay, para que el botón, su
// etiqueta y su color sean siempre los mismos estén donde estén.
export type NextAction = {
  next: OrderStatus;
  label: string;
  className: string;
};

export const NEXT_ACTION: Partial<Record<OrderStatus, NextAction>> = {
  PENDING: {
    next: "READY",
    label: "Listo",
    className: "bg-emerald-600 hover:bg-emerald-500 text-white",
  },
  IN_PROGRESS: {
    next: "READY",
    label: "Listo",
    className: "bg-emerald-600 hover:bg-emerald-500 text-white",
  },
  READY: {
    next: "DELIVERED",
    label: "Entregado",
    className: "bg-teal-600 hover:bg-teal-500 text-white",
  },
};
