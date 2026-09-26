// customer-portal/src/pages/restaurant/ReservationsManager.tsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  reservationsApi,
  type Reservation,
  type ReservationStatus,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import ConfirmDialog, {
  type ConfirmDialogTone,
} from "../../components/ConfirmDialog";
import { Icon, type IconName } from "../../components/icons";
import { getErrorMessage } from "../../utils/errors";
import { toLocalTimeString } from "../../utils/format";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  NO_SHOW: "No presentado",
};

const STATUS_STYLES: Record<ReservationStatus, string> = {
  PENDING:
    "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20",
  CONFIRMED:
    "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 ring-1 ring-teal-200 dark:ring-teal-500/20",
  CANCELLED:
    "bg-zinc-100 dark:bg-zinc-700/40 text-zinc-500 ring-1 ring-zinc-300 dark:ring-zinc-600/30",
  COMPLETED:
    "bg-zinc-100 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600/30",
  NO_SHOW:
    "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20",
};

// Un borde lateral de color por estado, coherente con el resto de la app.
const STATUS_ACCENT: Record<ReservationStatus, string> = {
  PENDING: "border-l-amber-500/70",
  CONFIRMED: "border-l-teal-500/70",
  CANCELLED: "border-l-zinc-300 dark:border-l-zinc-700",
  COMPLETED: "border-l-zinc-300 dark:border-l-zinc-700",
  NO_SHOW: "border-l-red-500/50",
};

const ALL_STATUSES = Object.keys(STATUS_LABEL) as ReservationStatus[];

// Título, texto del botón y tono del diálogo de confirmación para cada
// cambio de estado posible (todos piden confirmación, no solo cancelar
// y no presentado).
const STATUS_CONFIRM_CONFIG: Record<
  ReservationStatus,
  { title: string; confirmLabel: string; tone: ConfirmDialogTone }
> = {
  PENDING: {
    title: "¿Volver a pendiente?",
    confirmLabel: "Marcar como pendiente",
    tone: "warning",
  },
  CONFIRMED: {
    title: "¿Confirmar reserva?",
    confirmLabel: "Confirmar reserva",
    tone: "default",
  },
  COMPLETED: {
    title: "¿Marcar como completada?",
    confirmLabel: "Marcar como completada",
    tone: "default",
  },
  CANCELLED: {
    title: "¿Cancelar reserva?",
    confirmLabel: "Cancelar reserva",
    tone: "danger",
  },
  NO_SHOW: {
    title: "¿Marcar como no presentado?",
    confirmLabel: "Marcar como no presentado",
    tone: "warning",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateString(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

// ─── Tarjeta de reserva ─────────────────────────────────────────────────────

function ReservationCard({
  r,
  today,
  tomorrow,
  updating,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  r: Reservation;
  today: Date;
  tomorrow: Date;
  updating: boolean;
  onStatusChange: (status: ReservationStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Contacto y acciones de estado quedan ocultos tras "→" para que la
  // tarjeta, de un vistazo, solo muestre lo esencial (nombre, hora,
  // comensales, estado).
  const [expanded, setExpanded] = useState(false);

  // Acciones de estado disponibles para esta reserva, en el orden en que
  // deben mostrarse. Se listan como datos (en vez de JSX repetido) para
  // poder distribuirlas en una rejilla pareja de 2 columnas.
  const statusActions: {
    status: ReservationStatus;
    label: string;
    icon: IconName;
    className: string;
  }[] = [];
  if (r.status === "PENDING") {
    statusActions.push({
      status: "CONFIRMED",
      label: "Confirmar",
      icon: "check",
      className:
        "bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20",
    });
  }
  if (r.status === "CONFIRMED") {
    statusActions.push({
      status: "COMPLETED",
      label: "Completada",
      icon: "check",
      className:
        "bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    });
  }
  // "Cancelar" va antes que "No presentado" a propósito: cuando el número
  // de botones es impar, el último ocupa la fila entera, y "No presentado"
  // (más largo) aprovecha mejor ese ancho sin partirse en dos líneas.
  if (!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(r.status)) {
    statusActions.push({
      status: "CANCELLED",
      label: "Cancelar",
      icon: "close",
      className:
        "bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
    });
  }
  if (["PENDING", "CONFIRMED"].includes(r.status)) {
    statusActions.push({
      status: "NO_SHOW",
      label: "No presentado",
      icon: "warningTriangle",
      className:
        "bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
    });
  }

  return (
    <div
      className={`flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 ${STATUS_ACCENT[r.status]} rounded-2xl p-4 gap-2.5`}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="min-w-0 font-semibold text-zinc-900 dark:text-zinc-100 truncate"
          title={r.customerName}
        >
          {r.customerName}
        </p>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[r.status]}`}
        >
          {STATUS_LABEL[r.status]}
        </span>
      </div>

      {/* Fecha / hora / comensales */}
      <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-2.5">
        <div>
          <p className="text-3xl font-black text-zinc-900 dark:text-zinc-100 leading-none tabular-nums">
            {toLocalTimeString(r.reservationDate)}
          </p>
          <p className="text-xs text-zinc-500 mt-1.5">
            {isSameDay(r.reservationDate, today) ? (
              <span className="text-teal-700 dark:text-teal-400 font-medium">
                Hoy
              </span>
            ) : isSameDay(r.reservationDate, tomorrow) ? (
              "Mañana"
            ) : (
              toLocalDateString(r.reservationDate)
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <Icon name="users" className="w-4 h-4 text-zinc-500" />
          <span className="font-semibold">{r.guests}</span>
        </div>
      </div>

      {/* Notas: mismo formato que en cocina (icono + caja) */}
      {r.notes && (
        <div className="flex items-start gap-2 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2">
          <Icon
            name="warningCircle"
            className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-snug">
            {r.notes}
          </p>
        </div>
      )}

      {/* Panel expandible: contacto + acciones de estado.
          Se usa el truco de `grid-template-rows` 0fr→1fr en vez de un
          simple `{expanded && ...}` para que abra/cierre con una
          animación suave en lugar de aparecer/desaparecer de golpe. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2.5 flex flex-col gap-2.5">
            <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
              {r.customerEmail && <p className="truncate">{r.customerEmail}</p>}
              <p>{r.customerPhone}</p>
            </div>
            {statusActions.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {statusActions.map((action, i) => (
                  <button
                    key={action.status}
                    disabled={updating}
                    onClick={() => onStatusChange(action.status)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors disabled:opacity-50 ${action.className} ${
                      statusActions.length % 2 !== 0 &&
                      i === statusActions.length - 1
                        ? "col-span-2"
                        : ""
                    }`}
                  >
                    <Icon name={action.icon} className="w-3.5 h-3.5" />
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 mt-auto pt-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          title={
            expanded ? "Ocultar contacto y acciones" : "Ver contacto y acciones"
          }
          aria-label={
            expanded ? "Ocultar contacto y acciones" : "Ver contacto y acciones"
          }
          className={`p-2 rounded-lg transition-colors ${
            expanded
              ? "text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          <Icon
            name="chevronRight"
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            strokeWidth={2}
          />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onEdit}
            title="Editar reserva"
            aria-label="Editar reserva"
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Icon name="pencil" className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <button
            onClick={onDelete}
            title="Eliminar"
            aria-label="Eliminar"
            className="p-2 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <Icon name="trash" className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReservationsManager() {
  const instance = useRestaurantInstance();
  const id = instance?.id ?? 0;
  const slug = instance?.slug ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI state
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<ReservationStatus | "Todos">(
    "Todos",
  );
  const [dateFilter, setDateFilter] = useState<"hoy" | "mañana" | "todos">(
    "hoy",
  );

  // Confirmaciones pendientes, en vez de window.confirm(): cancelar y marcar
  // "no presentado" son difíciles de deshacer, igual que eliminar.
  const [statusConfirm, setStatusConfirm] = useState<{
    reservation: Reservation;
    status: ReservationStatus;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Reservation | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const {
    data: reservations = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["reservations", id],
    queryFn: () => reservationsApi.list(id),
    enabled: !!id,
  });
  const error = queryError
    ? getErrorMessage(queryError, "Error al cargar reservas")
    : null;

  // ── Date helpers ──────────────────────────────────────────────────────────

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reservations
      .filter((r) => {
        const matchesSearch =
          !q ||
          r.customerName.toLowerCase().includes(q) ||
          r.customerPhone.includes(q) ||
          r.customerEmail.toLowerCase().includes(q);

        const matchesStatus =
          activeStatus === "Todos" || r.status === activeStatus;

        const matchesDate =
          dateFilter === "todos" ||
          (dateFilter === "hoy" && isSameDay(r.reservationDate, today)) ||
          (dateFilter === "mañana" && isSameDay(r.reservationDate, tomorrow));

        return matchesSearch && matchesStatus && matchesDate;
      })
      .sort(
        (a, b) =>
          new Date(a.reservationDate).getTime() -
          new Date(b.reservationDate).getTime(),
      );
  }, [reservations, search, activeStatus, dateFilter, today, tomorrow]);

  const todayReservations = useMemo(
    () => reservations.filter((r) => isSameDay(r.reservationDate, today)),
    [reservations, today],
  );

  // ── Status update ─────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: ({
      reservationId,
      status,
    }: {
      reservationId: number;
      status: ReservationStatus;
    }) => reservationsApi.updateStatus(reservationId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations", id] });
      setStatusConfirm(null);
    },
    onError: (e: unknown) =>
      alert(getErrorMessage(e, "Error al actualizar estado")),
  });

  const handleStatusChange = (r: Reservation, newStatus: ReservationStatus) => {
    statusMutation.mutate({ reservationId: r.id, status: newStatus });
  };

  // Todo cambio de estado (confirmar, completar, cancelar o marcar como no
  // presentado) pide confirmación con el mismo diálogo que el resto de la
  // app, en vez de aplicarse al momento.
  const requestStatusChange = (
    r: Reservation,
    newStatus: ReservationStatus,
  ) => {
    setStatusConfirm({ reservation: r, status: newStatus });
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (reservationId: number) =>
      reservationsApi.remove(reservationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations", id] });
      setDeleteConfirm(null);
    },
    onError: (e: unknown) => alert(getErrorMessage(e, "Error al eliminar")),
  });

  const handleDelete = () => {
    if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error) {
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
            Reservas
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {todayReservations.length} reservas hoy ·{" "}
            {todayReservations.reduce((sum, r) => sum + r.guests, 0)} comensales
          </p>
        </div>
        <button
          onClick={() => navigate(`/restaurant/${slug}/reservations/new`)}
          className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-base font-bold rounded-xl transition-colors"
        >
          <Icon name="plus" className="w-5 h-5" />
          Reserva
        </button>
      </div>

      {/* Búsqueda + Filtros + Stats en la misma línea en escritorio */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        {/* Barra de búsqueda */}
        <div className="relative flex-1">
          <Icon
            name="search"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
          />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors"
          />
        </div>

        {/* Selector de fecha (hoy / mañana / todos) */}
        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shrink-0">
          {(["hoy", "mañana", "todos"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-4 py-2 text-base font-semibold rounded-lg transition-colors capitalize ${
                dateFilter === d
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {d === "todos" ? "Todos" : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {/* Filtrar por estado */}
        <div className="relative shrink-0">
          <Icon
            name="filter"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
          />
          <select
            value={activeStatus}
            onChange={(e) =>
              setActiveStatus(e.target.value as ReservationStatus | "Todos")
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
          </select>
          <Icon
            name="chevronDown"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
          />
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 lg:flex lg:items-center gap-2 lg:gap-x-6 lg:shrink-0 lg:px-5 lg:py-3.5 lg:bg-white lg:dark:bg-zinc-900 lg:border lg:border-zinc-200 lg:dark:border-zinc-800 lg:rounded-xl">
          {[
            {
              label: "Confirmadas hoy",
              value: todayReservations.filter((r) => r.status === "CONFIRMED")
                .length,
              color: "text-teal-700 dark:text-teal-400",
            },
            {
              label: "Pendientes hoy",
              value: todayReservations.filter((r) => r.status === "PENDING")
                .length,
              color: "text-amber-700 dark:text-amber-400",
            },
            {
              label: "No presentados",
              value: todayReservations.filter((r) => r.status === "NO_SHOW")
                .length,
              color: "text-red-700 dark:text-red-400",
            },
            {
              label: "Comensales esperados",
              value: todayReservations
                .filter((r) => ["CONFIRMED", "PENDING"].includes(r.status))
                .reduce((s, r) => s + r.guests, 0),
              color: "text-zinc-800 dark:text-zinc-200",
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

      {/* Rejilla de reservas */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filtered.map((r) => (
            <ReservationCard
              key={r.id}
              r={r}
              today={today}
              tomorrow={tomorrow}
              updating={
                statusMutation.isPending &&
                statusMutation.variables?.reservationId === r.id
              }
              onStatusChange={(status) => requestStatusChange(r, status)}
              onEdit={() =>
                navigate(`/restaurant/${slug}/reservations/${r.id}`)
              }
              onDelete={() => setDeleteConfirm(r)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-16 text-center text-zinc-500 text-sm">
          {search
            ? `No se encontraron reservas para «${search}».`
            : "No hay reservas para este período."}
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-4">
        {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        {activeStatus !== "Todos" && (
          <span className="ml-2 text-teal-700/70 dark:text-teal-500/60">
            · filtrado por {STATUS_LABEL[activeStatus as ReservationStatus]}
          </span>
        )}
      </p>

      {statusConfirm && (
        <ConfirmDialog
          title={STATUS_CONFIRM_CONFIG[statusConfirm.status].title}
          message={
            <>
              La reserva de{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {statusConfirm.reservation.customerName}
              </span>{" "}
              ({toLocalDateString(statusConfirm.reservation.reservationDate)}
              {" · "}
              {toLocalTimeString(statusConfirm.reservation.reservationDate)})
              pasará a estado «{STATUS_LABEL[statusConfirm.status]}».
            </>
          }
          confirmLabel={
            STATUS_CONFIRM_CONFIG[statusConfirm.status].confirmLabel
          }
          cancelLabel="Volver"
          tone={STATUS_CONFIRM_CONFIG[statusConfirm.status].tone}
          loading={
            statusMutation.isPending &&
            statusMutation.variables?.reservationId ===
              statusConfirm.reservation.id
          }
          onConfirm={() =>
            handleStatusChange(statusConfirm.reservation, statusConfirm.status)
          }
          onCancel={() => setStatusConfirm(null)}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="¿Eliminar reserva?"
          message={
            <>
              Se eliminará la reserva de{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {deleteConfirm.customerName}
              </span>
              . Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
