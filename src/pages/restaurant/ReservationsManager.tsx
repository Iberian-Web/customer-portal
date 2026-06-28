// customer-portal/src/components/ReservationsManager.tsx
import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { reservationsApi, type Reservation, type ReservationStatus, type ReservationCreate } from "../../api";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING:   "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  NO_SHOW:   "No presentado",
};

const STATUS_STYLES: Record<ReservationStatus, string> = {
  PENDING:   "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  CONFIRMED: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20",
  CANCELLED: "bg-zinc-700/40 text-zinc-500 ring-1 ring-zinc-600/30",
  COMPLETED: "bg-zinc-700/40 text-zinc-400 ring-1 ring-zinc-600/30",
  NO_SHOW:   "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
};

const ALL_STATUSES = Object.keys(STATUS_LABEL) as ReservationStatus[];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDateString(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
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

function ReservationModal({ mode, initial, saving, error, onSubmit, onClose }: ModalProps) {
  const [form, setForm] = useState<FormFields>(initial);

  const set = (key: keyof FormFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = () => {
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">
            {mode === "create" ? "Nueva reserva" : "Editar reserva"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Nombre completo <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.customerName}
              onChange={set("customerName")}
              placeholder="John Smith"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Teléfono <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              value={form.customerPhone}
              onChange={set("customerPhone")}
              placeholder="+34 666 111 222"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Email <span className="text-zinc-600 font-normal">(opcional)</span>
            </label>
            <input
              type="email"
              value={form.customerEmail}
              onChange={set("customerEmail")}
              placeholder="john@example.com"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Fecha <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={set("date")}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Hora <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={form.time}
                onChange={set("time")}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
          </div>

          {/* Guests */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Comensales <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={form.guests}
              onChange={set("guests")}
              placeholder="2"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Notas <span className="text-zinc-600 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={3}
              placeholder="Outdoor seating preferred…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {saving ? "Guardando…" : mode === "create" ? "Crear reserva" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReservationsManager() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const id = Number(instanceId);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<ReservationStatus | "Todos">("Todos");
  const [dateFilter, setDateFilter] = useState<"hoy" | "mañana" | "todos">("hoy");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState<FormFields>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Status update in progress
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reservationsApi.list(id);
      setReservations(data);
    } catch (e: any) {
      setError(e.message ?? "Error al cargar reservas");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
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
    return reservations.filter((r) => {
      const matchesSearch =
        !q ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.includes(q) ||
        r.customerEmail.toLowerCase().includes(q);

      const matchesStatus = activeStatus === "Todos" || r.status === activeStatus;

      const matchesDate =
        dateFilter === "todos" ||
        (dateFilter === "hoy" && isSameDay(r.reservationDate, today)) ||
        (dateFilter === "mañana" && isSameDay(r.reservationDate, tomorrow));

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [reservations, search, activeStatus, dateFilter, today, tomorrow]);

  const todayReservations = useMemo(
    () => reservations.filter((r) => isSameDay(r.reservationDate, today)),
    [reservations, today],
  );

  // ── Status update ─────────────────────────────────────────────────────────

  const handleStatusChange = async (r: Reservation, newStatus: ReservationStatus) => {
    setUpdatingId(r.id);
    try {
      const updated = await reservationsApi.updateStatus(r.id, newStatus);
      setReservations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      alert(e.message ?? "Error al actualizar estado");
    } finally {
      setUpdatingId(null);
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
    if (!form.customerName || !form.customerPhone || !form.date || !form.time || !form.guests) {
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
        setReservations((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      }
      setModalOpen(false);
    } catch (e: any) {
      setModalError(e.message ?? "Error al guardar la reserva");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (r: Reservation) => {
    if (!confirm(`¿Eliminar la reserva de ${r.customerName}?`)) return;
    try {
      await reservationsApi.remove(r.id);
      setReservations((prev) => prev.filter((x) => x.id !== r.id));
      if (expandedId === r.id) setExpandedId(null);
    } catch (e: any) {
      alert(e.message ?? "Error al eliminar");
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="px-8 py-8 max-w-6xl mx-auto w-full">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-400">
          {error}
          <button onClick={load} className="ml-4 underline hover:no-underline">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto w-full">

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Reservas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {todayReservations.length} reservas hoy ·{" "}
            {todayReservations.reduce((sum, r) => sum + r.guests, 0)} comensales
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nueva reserva
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Confirmadas hoy",
            value: todayReservations.filter((r) => r.status === "CONFIRMED").length,
            color: "text-indigo-400",
          },
          {
            label: "Pendientes hoy",
            value: todayReservations.filter((r) => r.status === "PENDING").length,
            color: "text-amber-400",
          },
          {
            label: "No presentados",
            value: todayReservations.filter((r) => r.status === "NO_SHOW").length,
            color: "text-red-400",
          },
          {
            label: "Comensales esperados",
            value: todayReservations
              .filter((r) => ["CONFIRMED", "PENDING"].includes(r.status))
              .reduce((s, r) => s + r.guests, 0),
            color: "text-zinc-200",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
            <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
            <p className={`text-2xl font-semibold ${color} tabular-nums`}>
              {loading ? <span className="w-8 h-7 bg-zinc-800 rounded animate-pulse inline-block" /> : value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
          />
        </div>
        {/* Date toggle */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          {(["hoy", "mañana", "todos"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                dateFilter === d
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {d === "todos" ? "Todos" : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {(["Todos", ...ALL_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeStatus === s
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {s === "Todos" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[17%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              {["Nombre", "Contacto", "Fecha", "Hora", "Comensales", "Estado"].map((h) => (
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
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((r) => (
                <>
                  <tr
                    key={r.id}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    {/* Name */}
                    <td className="px-5 py-3.5">
                      <span className="block font-medium text-zinc-200 truncate" title={r.customerName}>
                        {r.customerName}
                      </span>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-3.5">
                      <span className="block text-zinc-400 text-xs truncate" title={r.customerPhone}>
                        {r.customerPhone}
                      </span>
                      {r.customerEmail && (
                        <span className="block text-zinc-600 text-[10px] truncate" title={r.customerEmail}>
                          {r.customerEmail}
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5">
                      <span className="text-zinc-400 text-xs tabular-nums whitespace-nowrap">
                        {isSameDay(r.reservationDate, today) ? (
                          <span className="text-indigo-400 font-medium">Hoy</span>
                        ) : isSameDay(r.reservationDate, tomorrow) ? (
                          <span className="text-zinc-300">Mañana</span>
                        ) : (
                          toLocalDateString(r.reservationDate)
                        )}
                      </span>
                    </td>

                    {/* Time */}
                    <td className="px-5 py-3.5">
                      <span className="text-zinc-200 font-medium tabular-nums">
                        {toLocalTimeString(r.reservationDate)}
                      </span>
                    </td>

                    {/* Guests */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <svg
                          className="w-3.5 h-3.5 text-zinc-500 shrink-0"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        <span className="text-zinc-300 font-medium">{r.guests}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${STATUS_STYLES[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>

                    {/* Expand chevron */}
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded-md transition-colors"
                      >
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${expandedId === r.id ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expandedId === r.id && (
                    <tr key={`${r.id}-detail`} className="bg-zinc-950/50">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="flex gap-8 flex-wrap">

                          {/* Contact */}
                          <div className="min-w-35">
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                              Contacto
                            </p>
                            <p className="text-sm text-zinc-300">{r.customerName}</p>
                            <p className="text-xs text-zinc-500 mt-1">{r.customerPhone}</p>
                            {r.customerEmail && (
                              <p className="text-xs text-zinc-500">{r.customerEmail}</p>
                            )}
                          </div>

                          {/* Reservation detail */}
                          <div className="min-w-45">
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                              Reserva
                            </p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 w-24">Fecha</span>
                                <span className="text-zinc-300">{toLocalDateString(r.reservationDate)}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 w-24">Hora</span>
                                <span className="text-zinc-300">{toLocalTimeString(r.reservationDate)}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 w-24">Comensales</span>
                                <span className="text-zinc-300">{r.guests}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 w-24">Creada el</span>
                                <span className="text-zinc-500 text-xs">{toLocalDateString(r.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          {r.notes && (
                            <div className="flex-1 min-w-40">
                              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                Notas
                              </p>
                              <p className="text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 max-w-xs">
                                {r.notes}
                              </p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="ml-auto flex flex-col gap-2 min-w-35" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                              Acciones
                            </p>

                            {/* Confirm */}
                            {r.status === "PENDING" && (
                              <button
                                disabled={updatingId === r.id}
                                onClick={() => handleStatusChange(r, "CONFIRMED")}
                                className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg border border-indigo-500/20 transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                Confirmar reserva
                              </button>
                            )}

                            {/* Complete */}
                            {r.status === "CONFIRMED" && (
                              <button
                                disabled={updatingId === r.id}
                                onClick={() => handleStatusChange(r, "COMPLETED")}
                                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                Marcar completada
                              </button>
                            )}

                            {/* No show */}
                            {["PENDING", "CONFIRMED"].includes(r.status) && (
                              <button
                                disabled={updatingId === r.id}
                                onClick={() => handleStatusChange(r, "NO_SHOW")}
                                className="px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-medium rounded-lg border border-orange-500/20 transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                No se presentó
                              </button>
                            )}

                            {/* Cancel */}
                            {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(r.status) && (
                              <button
                                disabled={updatingId === r.id}
                                onClick={() => handleStatusChange(r, "CANCELLED")}
                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/20 transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                Cancelar reserva
                              </button>
                            )}

                            {/* Edit */}
                            <button
                              onClick={() => openEdit(r)}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
                            >
                              Editar
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(r)}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 text-xs font-medium rounded-lg border border-zinc-700 hover:border-red-500/20 transition-colors"
                            >
                              Eliminar
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
                <td colSpan={7} className="px-5 py-12 text-center text-zinc-500 text-sm">
                  {search
                    ? `No se encontraron reservas para «${search}».`
                    : "No hay reservas para este período."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600 mt-3">
        {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        {activeStatus !== "Todos" && (
          <span className="ml-2 text-indigo-500/60">
            · filtrado por {STATUS_LABEL[activeStatus as ReservationStatus]}
          </span>
        )}
      </p>
    </div>
  );
}
