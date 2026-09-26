// customer-portal/src/pages/restaurant/Analytics.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  analyticsApi,
  analyticsPdfUrl,
  auditLogApi,
  type OrderStatus,
  type ReservationStatus,
  type AuditLogAction,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import { Spinner, Icon } from "../../components/icons";
import { getErrorMessage } from "../../utils/errors";
import { money, toLocalDateTimeString } from "../../utils/format";

// ─── Selector de mes ────────────────────────────────────────────────────────────

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const shifted = new Date(y, m - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Nuevos",
  IN_PROGRESS: "En cocina",
  READY: "Listos",
  DELIVERED: "Entregados",
  CANCELLED: "Cancelados",
};

const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "Pendientes",
  CONFIRMED: "Confirmadas",
  CANCELLED: "Canceladas",
  COMPLETED: "Completadas",
  NO_SHOW: "No presentados",
};

function StatCard({
  label,
  value,
  hint,
  color,
  className = "",
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
  className?: string;
}) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 sm:px-6 sm:py-5 ${className}`}
    >
      <p className="text-xs sm:text-sm font-medium text-zinc-500">{label}</p>
      <p
        className={`mt-1.5 sm:mt-2 text-xl sm:text-3xl font-black tabular-nums leading-none ${color}`}
      >
        {value}
      </p>
      <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-zinc-500 min-h-[1.1rem] sm:min-h-[1.25rem]">
        {hint ?? "\u00A0"}
      </p>
    </div>
  );
}

function BreakdownRow({
  label,
  count,
  pct,
  barColor,
}: {
  label: string;
  count: number;
  pct: number;
  barColor: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-1.5">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
          {count}
        </span>
      </div>
      <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const AUDIT_ACTION_LABEL: Record<AuditLogAction, string> = {
  ORDER_CANCELLED: "Pedido cancelado",
  ORDER_DELETED: "Pedido eliminado",
  TABLE_SESSION_CLOSED: "Mesa cerrada y cobrada",
  TABLE_DELETED: "Mesa eliminada del mapa",
};

const AUDIT_ACTION_COLOR: Record<AuditLogAction, string> = {
  ORDER_CANCELLED:
    "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300",
  ORDER_DELETED: "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300",
  TABLE_SESSION_CLOSED:
    "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  TABLE_DELETED: "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300",
};

/**
 * Histórico de operaciones irreversibles (cancelar/eliminar un pedido,
 * cerrar o eliminar una mesa): quién lo hizo y cuándo, con un filtro
 * opcional por número de mesa — pensado para responder "¿qué pasó con la
 * mesa 7 anoche?" sin depender de la memoria de nadie.
 */
function AuditLogSection({ instanceId }: { instanceId: number }) {
  const [tableFilterInput, setTableFilterInput] = useState("");
  const tableNumber = tableFilterInput.trim()
    ? Number(tableFilterInput)
    : undefined;
  const validFilter =
    tableNumber === undefined ||
    (Number.isInteger(tableNumber) && tableNumber > 0);

  const {
    data: logs = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["audit-log", instanceId, validFilter ? tableNumber : "invalid"],
    queryFn: () => auditLogApi.list(instanceId, { tableNumber }),
    enabled: !!instanceId && validFilter,
  });
  const error = queryError
    ? getErrorMessage(queryError, "No se pudo cargar el histórico")
    : null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
          Historial de auditoría
        </h2>
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          Mesa
          <input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Todas"
            value={tableFilterInput}
            onChange={(e) => setTableFilterInput(e.target.value)}
            className="w-20 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
            aria-label="Filtrar historial por número de mesa"
          />
        </label>
      </div>

      {!validFilter ? (
        <p className="text-sm text-zinc-500">
          Introduce un número de mesa válido.
        </p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : isLoading ? (
        <div className="flex items-center gap-3 text-zinc-500 text-sm">
          <Spinner className="w-5 h-5" /> Cargando…
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No hay entradas{tableNumber ? ` para la mesa ${tableNumber}` : ""}.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {logs.map((log) => (
            <li
              key={log.id}
              className="py-3 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${AUDIT_ACTION_COLOR[log.action]}`}
                >
                  {AUDIT_ACTION_LABEL[log.action]}
                </span>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {log.tableNumber ? `Mesa ${log.tableNumber} · ` : ""}
                  {log.summary}
                </span>
              </div>
              <div className="text-xs text-zinc-500 text-right">
                <div>{log.actorName}</div>
                <div>{toLocalDateTimeString(log.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const instance = useRestaurantInstance();
  const instanceId = instance?.id ?? 0;

  // Mes natural seleccionado (por defecto, el mes en curso — igual que si no
  // se mandara `month` al backend). Cambiar de mes es solo cambiar este
  // estado y dejar que React Query pida el nuevo periodo.
  const [month, setMonth] = useState(currentMonthKey);

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["analytics", instanceId, month],
    queryFn: () => analyticsApi.get(instanceId, { month }),
    enabled: !!instanceId,
  });
  const error = queryError
    ? getErrorMessage(queryError, "No se pudieron cargar las analíticas")
    : null;

  // Navegador de mes + descarga de PDF: se muestra siempre (cargando,
  // erróneo u ok) para poder cambiar de mes aunque el actual haya fallado,
  // en vez de dejar a quien lo usa completamente atascado.
  const isCurrentMonth = data
    ? data.period.isCurrentMonth
    : month >= currentMonthKey();
  // No se puede retroceder más allá del mes de alta del cliente (no hay
  // datos antes). Sin ese límite aún cargado, no se bloquea el botón.
  const isEarliestMonth = data ? month <= data.period.earliestMonth : false;
  const monthNav = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Analíticas
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Resumen general de la actividad del restaurante
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-1.5 py-1.5">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
            disabled={isEarliestMonth}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="Mes anterior"
            aria-label="Mes anterior"
          >
            <Icon name="chevronLeft" className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 min-w-36 text-center capitalize">
            {data?.period.label ?? month}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title="Mes siguiente"
            aria-label="Mes siguiente"
          >
            <Icon name="chevronRight" className="w-4 h-4" />
          </button>
        </div>
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={() => setMonth(currentMonthKey())}
            className="text-sm text-teal-700 dark:text-teal-400 hover:underline px-1"
          >
            Hoy
          </button>
        )}
        <a
          href={analyticsPdfUrl(instanceId, month)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title="Descargar informe del mes en PDF"
        >
          <Icon name="download" className="w-4 h-4" />
          <span className="hidden sm:inline">Informe PDF</span>
        </a>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="px-6 lg:px-8 py-6 w-full">
        {monthNav}
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="px-6 lg:px-8 py-6 w-full">
        {monthNav}
        <div className="flex items-center gap-3 text-zinc-500 text-sm">
          <Spinner className="w-5 h-5" /> Cargando analíticas…
        </div>
      </div>
    );
  }

  const maxDailyRevenue = Math.max(
    1,
    ...data.orders.dailySeries.map((d) => d.revenue),
  );
  const maxDishQuantity = Math.max(1, ...data.topDishes.map((d) => d.quantity));

  return (
    <div className="px-6 lg:px-8 py-6 w-full">
      {monthNav}

      {/* Stat cards: en móvil, "Facturado este mes" ocupa las dos columnas
          y el resto se acomoda en una rejilla de 2×2 debajo, para que nada
          salte de línea con menos ancho disponible. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <StatCard
          label={
            data.period.isCurrentMonth
              ? "Facturado este mes"
              : "Facturado el mes seleccionado"
          }
          value={money(data.revenue.total)}
          color="text-teal-700 dark:text-teal-400"
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          label="Facturado hoy"
          value={money(data.revenue.today)}
          color="text-teal-700 dark:text-teal-400"
        />
        <StatCard
          label="Ticket medio"
          value={money(data.revenue.averageOrderValue)}
          color="text-zinc-900 dark:text-zinc-100"
        />
        <StatCard
          label="Pedidos totales"
          value={String(data.orders.total)}
          color="text-zinc-900 dark:text-zinc-100"
        />
        <StatCard
          label="Reservas totales"
          value={String(data.reservations.total)}
          hint={`${data.reservations.upcoming} próximas`}
          color="text-blue-700 dark:text-blue-400"
        />
      </div>

      {/* Ingresos por día del mes seleccionado */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-5 capitalize">
          Ingresos por día · {data.period.label}
        </h2>
        <div className="flex items-end gap-1 h-48">
          {data.orders.dailySeries.map((d) => (
            <div
              key={d.date}
              className="flex-1 bg-teal-500/70 hover:bg-teal-500 rounded-t-sm transition-colors"
              style={{
                height: `${Math.max(2, (d.revenue / maxDailyRevenue) * 100)}%`,
              }}
              title={`${d.date}: ${money(d.revenue)} · ${d.orders} pedidos`}
            />
          ))}
        </div>
        <div className="flex justify-between text-sm text-zinc-500 mt-3">
          <span>{data.orders.dailySeries[0]?.date}</span>
          <span>
            {data.orders.dailySeries[data.orders.dailySeries.length - 1]?.date}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pedidos por estado */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-5">
            Pedidos por estado
          </h2>
          <div className="space-y-4">
            {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map(
              (status) => (
                <BreakdownRow
                  key={status}
                  label={ORDER_STATUS_LABEL[status]}
                  count={data.orders.byStatus[status]}
                  pct={
                    data.orders.total
                      ? (data.orders.byStatus[status] / data.orders.total) * 100
                      : 0
                  }
                  barColor="bg-teal-500"
                />
              ),
            )}
          </div>
        </div>

        {/* Platos más pedidos */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-5">
            Platos más pedidos
          </h2>
          {data.topDishes.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Todavía no hay pedidos suficientes.
            </p>
          ) : (
            <div className="space-y-4">
              {data.topDishes.map((dish, i) => (
                <div key={dish.name}>
                  <div className="flex justify-between items-baseline gap-3 text-sm mb-1.5">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {i + 1}. {dish.name}
                    </span>
                    <span className="shrink-0 text-zinc-500">
                      {dish.quantity} uds · {money(dish.revenue)}
                    </span>
                  </div>
                  <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${(dish.quantity / maxDishQuantity) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reservas */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-5">
            Reservas por estado
          </h2>
          <div className="space-y-4 mb-5">
            {(Object.keys(RESERVATION_STATUS_LABEL) as ReservationStatus[]).map(
              (status) => (
                <BreakdownRow
                  key={status}
                  label={RESERVATION_STATUS_LABEL[status]}
                  count={data.reservations.byStatus[status]}
                  pct={
                    data.reservations.total
                      ? (data.reservations.byStatus[status] /
                          data.reservations.total) *
                        100
                      : 0
                  }
                  barColor="bg-blue-500"
                />
              ),
            )}
          </div>
          <div className="flex justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800 text-sm">
            <div>
              <p className="text-zinc-500">Comensales totales</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {data.reservations.totalGuests}
              </p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500">Tasa de no-shows</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {Math.round(data.reservations.noShowRate * 1000) / 10}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <AuditLogSection instanceId={instanceId} />
    </div>
  );
}
