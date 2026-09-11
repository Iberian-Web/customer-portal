// customer-portal/src/components/ReservationsManager.tsx
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  reservationsApi,
  type Reservation,
  type ReservationStatus,
  type ReservationCreate,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import ConfirmDialog from "../../components/ConfirmDialog";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateString(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toLocalTimeString(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Convert a local date string (YYYY-MM-DD) + time string (HH:MM) to ISO 8601 */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

/** Convert an ISO date to YYYY-MM-DD for <input type="date"> */
function isoToDateInput(iso: string): string {
  return iso.split("T")[0];
}

/** Convert an ISO date to HH:MM for <input type="time"> */
function isoToTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormFields = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string;
  time: string;
  guests: string;
  notes: string;
};

const EMPTY_FORM: FormFields = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  date: "",
  time: "",
  guests: "",
  notes: "",
};

// ─── Modal ────────────────────────────────────────────────────────────────────

type ModalMode = "create" | "edit";

interface ModalProps {
  mode: ModalMode;
  initial: FormFields;
  saving: boolean;
  error: string | null;
  onSubmit: (f: FormFields) => void;
  onClose: () => void;
}

function ReservationModal({
  mode,
  initial,
  saving,
  error,
  onSubmit,
  onClose,
}: ModalProps) {
  const [form, setForm] = useState<FormFields>(initial);

  const set =
    (key: keyof FormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = () => {
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md mx-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {mode === "create" ? "Nueva reserva" : "Editar reserva"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Nombre completo{" "}
              <span className="text-red-700 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.customerName}
              onChange={set("customerName")}
              placeholder="John Smith"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Teléfono <span className="text-red-700 dark:text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={form.customerPhone}
              onChange={set("customerPhone")}
              placeholder="+34 666 111 222"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Email{" "}
              <span className="text-zinc-600 font-normal">(opcional)</span>
            </label>
            <input
              type="email"
              value={form.customerEmail}
              onChange={set("customerEmail")}
              placeholder="john@example.com"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
            />
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Fecha <span className="text-red-700 dark:text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={set("date")}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Hora <span className="text-red-700 dark:text-red-400">*</span>
              </label>
              <input
                type="time"
                value={form.time}
                onChange={set("time")}
                className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
              />
            </div>
          </div>

          {/* Guests */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Comensales{" "}
              <span className="text-red-700 dark:text-red-400">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={form.guests}
              onChange={set("guests")}
              placeholder="2"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              Notas{" "}
              <span className="text-zinc-600 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={3}
              placeholder="Outdoor seating preferred…"
              className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {saving
              ? "Guardando…"
              : mode === "create"
                ? "Crear reserva"
                : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
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
  return (
    <div
      className={`flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-l-4 ${STATUS_ACCENT[r.status]} rounded-2xl p-5 gap-3`}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="font-semibold text-zinc-900 dark:text-zinc-100 truncate"
            title={r.customerName}
          >
            {r.customerName}
          </p>
          <p className="text-xs text-zinc-500 mt-1.5 truncate">
            {r.customerPhone}
            {r.customerEmail && ` · ${r.customerEmail}`}
          </p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[r.status]}`}
        >
          {STATUS_LABEL[r.status]}
        </span>
      </div>

      {/* Fecha / hora / comensales */}
      <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3">
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
          <svg
            className="w-4 h-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
          <span className="font-semibold">{r.guests}</span>
        </div>
      </div>

      {/* Notas */}
      {r.notes && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 leading-snug">
          {r.notes}
        </p>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
        {r.status === "PENDING" && (
          <button
            disabled={updating}
            onClick={() => onStatusChange("CONFIRMED")}
            className="px-2.5 py-1.5 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-100 dark:hover:bg-teal-500/20 text-teal-700 dark:text-teal-400 text-xs font-medium rounded-lg border border-teal-200 dark:border-teal-500/20 transition-colors disabled:opacity-50"
          >
            Confirmar
          </button>
        )}
        {r.status === "CONFIRMED" && (
          <button
            disabled={updating}
            onClick={() => onStatusChange("COMPLETED")}
            className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-lg border border-emerald-200 dark:border-emerald-500/20 transition-colors disabled:opacity-50"
          >
            Completada
          </button>
        )}
        {["PENDING", "CONFIRMED"].includes(r.status) && (
          <button
            disabled={updating}
            onClick={() => onStatusChange("NO_SHOW")}
            className="px-2.5 py-1.5 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 text-orange-700 dark:text-orange-400 text-xs font-medium rounded-lg border border-orange-200 dark:border-orange-500/20 transition-colors disabled:opacity-50"
          >
            No presentado
          </button>
        )}
        {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(r.status) && (
          <button
            disabled={updating}
            onClick={() => onStatusChange("CANCELLED")}
            className="px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 text-xs font-medium rounded-lg border border-red-200 dark:border-red-500/20 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onEdit}
            title="Editar reserva"
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
            onClick={onDelete}
            title="Eliminar reserva"
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
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
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

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<ReservationStatus | "Todos">(
    "Todos",
  );
  const [dateFilter, setDateFilter] = useState<"hoy" | "mañana" | "todos">(
    "hoy",
  );

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<FormFields>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Status update in progress
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Confirmaciones pendientes, en vez de window.confirm(): cancelar y marcar
  // "no presentado" son difíciles de deshacer, igual que eliminar.
  const [statusConfirm, setStatusConfirm] = useState<{
    reservation: Reservation;
    status: ReservationStatus;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Reservation | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reservationsApi.list(id);
      setReservations(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Error al cargar reservas"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

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

  const handleStatusChange = async (
    r: Reservation,
    newStatus: ReservationStatus,
  ) => {
    setUpdatingId(r.id);
    try {
      const updated = await reservationsApi.updateStatus(r.id, newStatus);
      setReservations((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x)),
      );
      setStatusConfirm(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al actualizar estado"));
    } finally {
      setUpdatingId(null);
    }
  };

  // "Confirmar" y "Completada" son acciones positivas y se aplican al
  // momento; "Cancelar" y "No presentado" son difíciles de deshacer, así
  // que antes piden confirmación con el mismo diálogo que el resto de la app.
  const requestStatusChange = (
    r: Reservation,
    newStatus: ReservationStatus,
  ) => {
    if (newStatus === "CANCELLED" || newStatus === "NO_SHOW") {
      setStatusConfirm({ reservation: r, status: newStatus });
    } else {
      void handleStatusChange(r, newStatus);
    }
  };

  // ── Create ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setModalMode("create");
    setModalInitial(EMPTY_FORM);
    setEditingId(null);
    setModalError(null);
    setModalOpen(true);
  };

  // ── Edit ──────────────────────────────────────────────────────────────────

  const openEdit = (r: Reservation) => {
    setModalMode("edit");
    setModalInitial({
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      date: isoToDateInput(r.reservationDate),
      time: isoToTimeInput(r.reservationDate),
      guests: String(r.guests),
      notes: r.notes,
    });
    setEditingId(r.id);
    setModalError(null);
    setModalOpen(true);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleModalSubmit = async (form: FormFields) => {
    if (
      !form.customerName ||
      !form.customerPhone ||
      !form.date ||
      !form.time ||
      !form.guests
    ) {
      setModalError("Por favor completa los campos obligatorios.");
      return;
    }

    const payload: ReservationCreate = {
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail || undefined,
      reservationDate: toIso(form.date, form.time),
      guests: Number(form.guests),
      notes: form.notes || undefined,
    };

    setSaving(true);
    setModalError(null);
    try {
      if (modalMode === "create") {
        const created = await reservationsApi.create(id, payload);
        setReservations((prev) => [created, ...prev]);
      } else if (editingId !== null) {
        const updated = await reservationsApi.update(editingId, payload);
        setReservations((prev) =>
          prev.map((x) => (x.id === updated.id ? updated : x)),
        );
      }
      setModalOpen(false);
    } catch (e: unknown) {
      setModalError(getErrorMessage(e, "Error al guardar la reserva"));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await reservationsApi.remove(deleteConfirm.id);
      setReservations((prev) => prev.filter((x) => x.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e: unknown) {
      alert(getErrorMessage(e, "Error al eliminar"));
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
      {/* Modal */}
      {modalOpen && (
        <ReservationModal
          mode={modalMode}
          initial={modalInitial}
          saving={saving}
          error={modalError}
          onSubmit={handleModalSubmit}
          onClose={() => setModalOpen(false)}
        />
      )}

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
          onClick={openCreate}
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
          Nueva reserva
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl mb-6">
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

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-56">
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
            placeholder="Buscar por nombre, teléfono o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors"
          />
        </div>
        {/* Date toggle */}
        <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5">
          {(["hoy", "mañana", "todos"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-md transition-colors capitalize ${
                dateFilter === d
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {d === "todos" ? "Todos" : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        {/* Status pills */}
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

      {/* Rejilla de reservas */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filtered.map((r) => (
            <ReservationCard
              key={r.id}
              r={r}
              today={today}
              tomorrow={tomorrow}
              updating={updatingId === r.id}
              onStatusChange={(status) => requestStatusChange(r, status)}
              onEdit={() => openEdit(r)}
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
          title={
            statusConfirm.status === "CANCELLED"
              ? "¿Cancelar reserva?"
              : "¿Marcar como no presentado?"
          }
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
            statusConfirm.status === "CANCELLED"
              ? "Cancelar reserva"
              : "Marcar como no presentado"
          }
          cancelLabel="Volver"
          tone={statusConfirm.status === "CANCELLED" ? "danger" : "warning"}
          loading={updatingId === statusConfirm.reservation.id}
          onConfirm={() =>
            void handleStatusChange(
              statusConfirm.reservation,
              statusConfirm.status,
            )
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
          confirmLabel="Eliminar reserva"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
