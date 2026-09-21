// customer-portal/src/pages/restaurant/Analytics.tsx
import { useQuery } from "@tanstack/react-query";
import {
  analyticsApi,
  type OrderStatus,
  type ReservationStatus,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import { Spinner } from "../../components/icons";
import { getErrorMessage } from "../../utils/errors";
import { money } from "../../utils/format";

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
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-6 py-5">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-black tabular-nums leading-none ${color}`}
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-zinc-500 min-h-[1.25rem]">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const instance = useRestaurantInstance();
  const instanceId = instance?.id ?? 0;

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["analytics", instanceId],
    queryFn: () => analyticsApi.get(instanceId),
    enabled: !!instanceId,
  });
  const error = queryError
    ? getErrorMessage(queryError, "No se pudieron cargar las analíticas")
    : null;

  if (error) {
    return (
      <div className="px-6 lg:px-8 py-6 w-full">
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="px-6 lg:px-8 py-6 w-full">
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Analíticas
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Resumen general de la actividad del restaurante
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Ingresos totales"
          value={money(data.revenue.total)}
          color="text-teal-700 dark:text-teal-400"
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

      {/* Ingresos últimos 30 días */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-5">
          Ingresos · últimos 30 días
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
    </div>
  );
}
