import { useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReservationStatus = "CONFIRMED" | "PENDING" | "SEATED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

interface Reservation {
  id: number;
  guestName: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  partySize: number;
  tableNumber: number | null;
  status: ReservationStatus;
  notes?: string;
  source: "Web" | "Teléfono" | "Walk-in";
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockReservations: Reservation[] = [
  {
    id: 1,
    guestName: "Ana Martínez",
    phone: "+34 612 345 678",
    email: "ana@example.com",
    date: "2025-06-18",
    time: "13:30",
    partySize: 4,
    tableNumber: 5,
    status: "CONFIRMED",
    source: "Web",
  },
  {
    id: 2,
    guestName: "Javier López",
    phone: "+34 698 765 432",
    email: "javier@example.com",
    date: "2025-06-18",
    time: "14:00",
    partySize: 2,
    tableNumber: 3,
    status: "SEATED",
    notes: "Aniversario — mesa con vela",
    source: "Teléfono",
  },
  {
    id: 3,
    guestName: "Lucía Fernández",
    phone: "+34 677 111 222",
    email: "lucia@example.com",
    date: "2025-06-18",
    time: "14:30",
    partySize: 6,
    tableNumber: null,
    status: "PENDING",
    notes: "Un comensal con silla de ruedas",
    source: "Web",
  },
  {
    id: 4,
    guestName: "Carlos Ruiz",
    phone: "+34 654 333 444",
    email: "carlos@example.com",
    date: "2025-06-18",
    time: "15:00",
    partySize: 3,
    tableNumber: 8,
    status: "CONFIRMED",
    source: "Teléfono",
  },
  {
    id: 5,
    guestName: "Isabel Torres",
    phone: "+34 611 555 666",
    email: "isabel@example.com",
    date: "2025-06-17",
    time: "21:00",
    partySize: 2,
    tableNumber: 2,
    status: "COMPLETED",
    source: "Web",
  },
  {
    id: 6,
    guestName: "Roberto Sanz",
    phone: "+34 699 888 777",
    email: "roberto@example.com",
    date: "2025-06-17",
    time: "21:30",
    partySize: 4,
    tableNumber: 6,
    status: "NO_SHOW",
    source: "Teléfono",
  },
  {
    id: 7,
    guestName: "Patricia Gómez",
    phone: "+34 622 444 111",
    email: "patricia@example.com",
    date: "2025-06-19",
    time: "13:00",
    partySize: 8,
    tableNumber: null,
    status: "CONFIRMED",
    notes: "Comida de empresa — menú cerrado",
    source: "Web",
  },
  {
    id: 8,
    guestName: "David Moreno",
    phone: "+34 645 222 999",
    email: "david@example.com",
    date: "2025-06-18",
    time: "20:30",
    partySize: 2,
    tableNumber: 1,
    status: "CANCELLED",
    source: "Walk-in",
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const statusLabel: Record<ReservationStatus, string> = {
  CONFIRMED: "Confirmada",
  PENDING: "Pendiente",
  SEATED: "En mesa",
  COMPLETED: "Completada",
  NO_SHOW: "No presentado",
  CANCELLED: "Cancelada",
};

const statusStyles: Record<ReservationStatus, string> = {
  CONFIRMED: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20",
  PENDING: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  SEATED: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  COMPLETED: "bg-zinc-700/40 text-zinc-400 ring-1 ring-zinc-600/30",
  NO_SHOW: "bg-red-500/10 text-red-400 ring-1 ring-red-500/20",
  CANCELLED: "bg-zinc-700/40 text-zinc-500 ring-1 ring-zinc-600/30",
};

const sourceStyles: Record<Reservation["source"], string> = {
  Web: "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20",
  Teléfono: "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20",
  "Walk-in": "bg-zinc-700/40 text-zinc-400 ring-1 ring-zinc-600/30",
};

const ALL_STATUSES = Object.keys(statusLabel) as ReservationStatus[];
const TODAY = "2025-06-18";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReservationsManager() {
  const [reservations] = useState<Reservation[]>(mockReservations);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState<ReservationStatus | "Todos">("Todos");
  const [dateFilter, setDateFilter] = useState<"hoy" | "mañana" | "todos">("hoy");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reservations.filter((r) => {
      const matchesSearch =
        r.guestName.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.email.toLowerCase().includes(q) ||
        String(r.tableNumber).includes(q);
      const matchesStatus = activeStatus === "Todos" || r.status === activeStatus;
      const matchesDate =
        dateFilter === "todos" ||
        (dateFilter === "hoy" && r.date === TODAY) ||
        (dateFilter === "mañana" && r.date === "2025-06-19");
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [reservations, search, activeStatus, dateFilter]);

  const todayReservations = reservations.filter((r) => r.date === TODAY);

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Reservas</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {todayReservations.length} reservas hoy ·{" "}
            {todayReservations.reduce((sum, r) => sum + r.partySize, 0)} comensales
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
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
            label: "En mesa ahora",
            value: todayReservations.filter((r) => r.status === "SEATED").length,
            color: "text-emerald-400",
          },
          {
            label: "Pendientes",
            value: todayReservations.filter((r) => r.status === "PENDING").length,
            color: "text-amber-400",
          },
          {
            label: "Comensales esperados",
            value: todayReservations
              .filter((r) => ["CONFIRMED", "PENDING"].includes(r.status))
              .reduce((s, r) => s + r.partySize, 0),
            color: "text-zinc-200",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
            <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
            <p className={`text-2xl font-semibold ${color} tabular-nums`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono, email o mesa..."
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
      <div className="flex items-center gap-2 mb-5">
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
            {s === "Todos" ? "Todos" : statusLabel[s]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              {["Nombre", "Contacto", "Fecha", "Hora", "Comensales", "Mesa", "Estado", "Origen"].map((h) => (
                <th key={h} className="px-5 py-3.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.length > 0 ? (
              filtered.map((r) => (
                <>
                  <tr
                    key={r.id}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    {/* Name */}
                    <td className="px-5 py-3.5">
                      <span className="block font-medium text-zinc-200 truncate" title={r.guestName}>
                        {r.guestName}
                      </span>
                    </td>
                    {/* Contact */}
                    <td className="px-5 py-3.5">
                      <span className="block text-zinc-400 text-xs truncate" title={r.phone}>
                        {r.phone}
                      </span>
                      <span className="block text-zinc-600 text-[10px] truncate" title={r.email}>
                        {r.email}
                      </span>
                    </td>
                    {/* Date */}
                    <td className="px-5 py-3.5">
                      <span className="text-zinc-400 text-xs tabular-nums whitespace-nowrap">
                        {r.date === TODAY ? (
                          <span className="text-indigo-400 font-medium">Hoy</span>
                        ) : (
                          r.date
                        )}
                      </span>
                    </td>
                    {/* Time */}
                    <td className="px-5 py-3.5">
                      <span className="text-zinc-200 font-medium tabular-nums">{r.time}</span>
                    </td>
                    {/* Party size */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        <span className="text-zinc-300 font-medium">{r.partySize}</span>
                      </div>
                    </td>
                    {/* Table */}
                    <td className="px-5 py-3.5">
                      {r.tableNumber ? (
                        <span className="text-zinc-300 font-medium">Mesa {r.tableNumber}</span>
                      ) : (
                        <span className="text-zinc-600 text-xs">Sin asignar</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusStyles[r.status]}`}
                      >
                        {statusLabel[r.status]}
                      </span>
                    </td>
                    {/* Source */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${sourceStyles[r.source]}`}
                      >
                        {r.source}
                      </span>
                    </td>
                    {/* Expand */}
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded-md transition-colors"
                      >
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${expandedId === r.id ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {/* Expanded detail */}
                  {expandedId === r.id && (
                    <tr key={`${r.id}-detail`} className="bg-zinc-950/50">
                      <td colSpan={9} className="px-5 py-4">
                        <div className="flex gap-8">
                          {/* Contact detail */}
                          <div>
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                              Contacto
                            </p>
                            <p className="text-sm text-zinc-300">{r.guestName}</p>
                            <p className="text-xs text-zinc-500 mt-1">{r.phone}</p>
                            <p className="text-xs text-zinc-500">{r.email}</p>
                          </div>
                          {/* Reservation detail */}
                          <div>
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                              Reserva
                            </p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 w-20">Fecha</span>
                                <span className="text-zinc-300">{r.date}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 w-20">Hora</span>
                                <span className="text-zinc-300">{r.time}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 w-20">Comensales</span>
                                <span className="text-zinc-300">{r.partySize}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-zinc-500 w-20">Mesa</span>
                                <span className="text-zinc-300">
                                  {r.tableNumber ? `Mesa ${r.tableNumber}` : "Sin asignar"}
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* Notes */}
                          {r.notes && (
                            <div className="flex-1">
                              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                                Notas
                              </p>
                              <p className="text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 max-w-xs">
                                {r.notes}
                              </p>
                            </div>
                          )}
                          {/* Actions */}
                          <div className="ml-auto flex flex-col gap-2">
                            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                              Acciones
                            </p>
                            {r.status === "CONFIRMED" && (
                              <button className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors whitespace-nowrap">
                                Sentar a la mesa
                              </button>
                            )}
                            {r.tableNumber === null && r.status !== "CANCELLED" && r.status !== "COMPLETED" && (
                              <button className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium rounded-lg border border-indigo-500/20 transition-colors whitespace-nowrap">
                                Asignar mesa
                              </button>
                            )}
                            {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(r.status) && (
                              <button className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/20 transition-colors whitespace-nowrap">
                                Cancelar reserva
                              </button>
                            )}
                            <button className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-colors">
                              Editar
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
                <td colSpan={9} className="px-5 py-12 text-center text-zinc-500 text-sm">
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
            · filtrado por {statusLabel[activeStatus as ReservationStatus]}
          </span>
        )}
      </p>
    </div>
  );
}
