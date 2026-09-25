import type { TableMapStatus } from "../api";

export const TABLE_STATUS_LABEL: Record<TableMapStatus, string> = {
  LIBRE: "Libre",
  EN_COCINA: "En cocina",
  LISTO: "Listo para servir",
  PARA_COBRAR: "Para cobrar",
};

// Badge (texto sobre fondo suave), igual criterio que STATUS_STYLES de
// orderStatus.ts, con una paleta propia para no confundir el estado de la
// MESA (ocupación) con el estado de un PEDIDO concreto.
export const TABLE_STATUS_STYLES: Record<TableMapStatus, string> = {
  LIBRE:
    "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-500/30",
  EN_COCINA:
    "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-500/30",
  LISTO:
    "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30",
  PARA_COBRAR:
    "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-200 dark:ring-violet-500/30",
};

// Relleno de la celda de la mesa en el mapa (y de la leyenda, que usa esta
// misma paleta): en modo oscuro un fondo de color a solo 10-15% de opacidad
// queda casi indistinguible del fondo — aquí se sube bastante la opacidad y
// el borde/texto se aclaran para que el color se reconozca de un vistazo.
export const TABLE_STATUS_CELL: Record<TableMapStatus, string> = {
  LIBRE:
    "bg-emerald-100 dark:bg-emerald-500/25 border-emerald-300 dark:border-emerald-400/70 text-emerald-800 dark:text-emerald-200",
  EN_COCINA:
    "bg-blue-100 dark:bg-blue-500/25 border-blue-300 dark:border-blue-400/70 text-blue-800 dark:text-blue-200",
  LISTO:
    "bg-amber-100 dark:bg-amber-500/25 border-amber-300 dark:border-amber-400/70 text-amber-800 dark:text-amber-200",
  PARA_COBRAR:
    "bg-violet-100 dark:bg-violet-500/25 border-violet-300 dark:border-violet-400/70 text-violet-800 dark:text-violet-200",
};
