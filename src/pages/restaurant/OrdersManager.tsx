import { useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  "PENDING" | "IN_PROGRESS" | "READY" | "DELIVERED" | "CANCELLED";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface Order {
  id: number;
  tableNumber: number;
  waiter: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  createdAt: string;
  notes?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockOrders: Order[] = [
  {
    id: 1001,
    tableNumber: 4,
    waiter: "María G.",
    status: "IN_PROGRESS",
    items: [
      { name: "Croquetas de jamón", qty: 2, price: 8.5 },
      { name: "Solomillo a la brasa", qty: 1, price: 24.5 },
      { name: "Agua mineral", qty: 2, price: 2.0 },
    ],
    total: 45.5,
    createdAt: "14:32",
    notes: "Sin gluten en las croquetas",
  },
  {
    id: 1002,
    tableNumber: 7,
    waiter: "Carlos R.",
    status: "PENDING",
    items: [
      { name: "Ensalada César", qty: 2, price: 11.0 },
      { name: "Pasta al pesto", qty: 1, price: 14.0 },
    ],
    total: 36.0,
    createdAt: "14:45",
  },
  {
    id: 1003,
    tableNumber: 2,
    waiter: "Laura M.",
    status: "READY",
    items: [
      { name: "Solomillo a la brasa", qty: 2, price: 24.5 },
      { name: "Tiramisú artesanal", qty: 2, price: 6.5 },
    ],
    total: 62.0,
    createdAt: "14:10",
  },
  {
    id: 1004,
    tableNumber: 11,
    waiter: "María G.",
    status: "DELIVERED",
    items: [
      { name: "Croquetas de jamón", qty: 1, price: 8.5 },
      { name: "Agua mineral", qty: 3, price: 2.0 },
    ],
    total: 14.5,
    createdAt: "13:58",
  },
  {
    id: 1005,
    tableNumber: 9,
    waiter: "Carlos R.",
    status: "CANCELLED",
    items: [{ name: "Pasta al pesto", qty: 2, price: 14.0 }],
    total: 28.0,
    createdAt: "13:30",
    notes: "Cliente se marchó",
  },
  {
    id: 1006,
    tableNumber: 1,
    waiter: "Laura M.",
    status: "IN_PROGRESS",
    items: [
      { name: "Ensalada César", qty: 1, price: 11.0 },
      { name: "Solomillo a la brasa", qty: 2, price: 24.5 },
      { name: "Tiramisú artesanal", qty: 1, price: 6.5 },
      { name: "Agua mineral", qty: 2, price: 2.0 },
    ],
    total: 70.5,
    createdAt: "14:50",
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En cocina",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const statusStyles: Record<OrderStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20",
  READY: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  DELIVERED: "bg-zinc-700/40 text-zinc-400 ring-1 ring-zinc-600/30",
  CANCELLED: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
};

const ALL_STATUSES = Object.keys(statusLabel) as OrderStatus[];

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrdersManager() {
  const [orders] = useState<Order[]>(mockOrders);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<OrderStatus | "Todos">(
    "Todos",
  );
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        String(o.tableNumber).includes(q) ||
        o.waiter.toLowerCase().includes(q) ||
        o.items.some((i) => i.name.toLowerCase().includes(q)) ||
        String(o.id).includes(q);
      const matchesStatus =
        activeStatus === "Todos" || o.status === activeStatus;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, activeStatus]);

  const activeOrders = orders.filter((o) =>
    ["PENDING", "IN_PROGRESS", "READY"].includes(o.status),
  );
  const totalRevenue = orders
    .filter((o) => o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Gestión de pedidos
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {activeOrders.length} pedidos activos · hoy
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors">
          <svg
            className="w-4 h-4"
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

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "En cocina",
            value: orders.filter((o) => o.status === "IN_PROGRESS").length,
            color: "text-blue-400",
          },
          {
            label: "Listos para servir",
            value: orders.filter((o) => o.status === "READY").length,
            color: "text-emerald-400",
          },
          {
            label: "Pendientes",
            value: orders.filter((o) => o.status === "PENDING").length,
            color: "text-amber-400",
          },
          {
            label: "Facturado hoy",
            value: `${totalRevenue.toFixed(2)} €`,
            color: "text-teal-400",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4"
          >
            <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
            <p className={`text-2xl font-semibold ${color} tabular-nums`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
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
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
          />
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-2 mb-5">
        {(["Todos", ...ALL_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeStatus === s
                ? "bg-teal-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {s === "Todos" ? "Todos" : statusLabel[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[14%]" />
            <col className="w-[30%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              {[
                "#",
                "Mesa",
                "Camarero",
                "Platos",
                "Total",
                "Estado",
                "Hora",
              ].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.length > 0 ? (
              filtered.map((order) => (
                <>
                  <tr
                    key={order.id}
                    onClick={() =>
                      setExpandedId(expandedId === order.id ? null : order.id)
                    }
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    {/* ID */}
                    <td className="px-5 py-3.5">
                      <span className="text-zinc-500 text-xs font-mono">
                        #{order.id}
                      </span>
                    </td>
                    {/* Table */}
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-zinc-200">
                        Mesa {order.tableNumber}
                      </span>
                    </td>
                    {/* Waiter */}
                    <td className="px-5 py-3.5">
                      <span
                        className="text-zinc-400 truncate block"
                        title={order.waiter}
                      >
                        {order.waiter}
                      </span>
                    </td>
                    {/* Items preview */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {order.items.slice(0, 2).map((item) => (
                          <span
                            key={item.name}
                            className="text-[10px] font-medium bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded truncate max-w-30"
                            title={item.name}
                          >
                            {item.qty}× {item.name}
                          </span>
                        ))}
                        {order.items.length > 2 && (
                          <span className="text-[10px] font-medium bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded shrink-0">
                            +{order.items.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Total */}
                    <td className="px-5 py-3.5">
                      <span className="text-zinc-200 font-medium tabular-nums">
                        {order.total.toFixed(2)} €
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusStyles[order.status]}`}
                      >
                        {statusLabel[order.status]}
                      </span>
                    </td>
                    {/* Time */}
                    <td className="px-5 py-3.5">
                      <span className="text-zinc-500 text-xs tabular-nums">
                        {order.createdAt}
                      </span>
                    </td>
                    {/* Expand icon */}
                    <td
                      className="px-5 py-3.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === order.id ? null : order.id,
                          )
                        }
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded-md transition-colors"
                      >
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${expandedId === order.id ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {/* Expanded detail */}
                  {expandedId === order.id && (
                    <tr key={`${order.id}-detail`} className="bg-zinc-950/50">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="flex gap-8">
                          <div className="flex-1">
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                              Detalle del pedido
                            </p>
                            <div className="space-y-1.5">
                              {order.items.map((item) => (
                                <div
                                  key={item.name}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span className="text-zinc-300">
                                    <span className="text-zinc-500 mr-2">
                                      {item.qty}×
                                    </span>
                                    {item.name}
                                  </span>
                                  <span className="text-zinc-400 tabular-nums">
                                    {(item.qty * item.price).toFixed(2)} €
                                  </span>
                                </div>
                              ))}
                              <div className="border-t border-zinc-800 pt-1.5 mt-1.5 flex items-center justify-between font-medium text-sm">
                                <span className="text-zinc-300">Total</span>
                                <span className="text-zinc-100 tabular-nums">
                                  {order.total.toFixed(2)} €
                                </span>
                              </div>
                            </div>
                          </div>
                          {order.notes && (
                            <div className="w-64">
                              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                Notas
                              </p>
                              <p className="text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                                {order.notes}
                              </p>
                            </div>
                          )}
                          <div className="flex flex-col gap-2 justify-start">
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                              Acciones
                            </p>
                            {order.status !== "DELIVERED" &&
                              order.status !== "CANCELLED" && (
                                <button className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors">
                                  Marcar como listo
                                </button>
                              )}
                            {order.status !== "DELIVERED" &&
                              order.status !== "CANCELLED" && (
                                <button className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/20 transition-colors">
                                  Cancelar pedido
                                </button>
                              )}
                            <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-colors">
                              Imprimir ticket
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-12 text-center text-zinc-500 text-sm"
                >
                  {search
                    ? `No se encontraron pedidos para «${search}».`
                    : "No hay pedidos aún."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600 mt-3">
        {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        {activeStatus !== "Todos" && (
          <span className="ml-2 text-teal-500/60">
            · filtrado por {statusLabel[activeStatus as OrderStatus]}
          </span>
        )}
      </p>
    </div>
  );
}
