// customer-portal/src/components/Sidebar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { portalApi, type MyAccess, type Instance } from "../api";
import { useAuth } from "../contexts/AuthContext";

// ─── Service → route/icon registry ───────────────────────────────────────────
type NavEntry = {
  label: string;
  to: string;
  icon: React.ReactNode;
};

const iconClass = "w-4 h-4";

const SERVICE_ROUTE_MAP: Record<string, (instanceId: number) => NavEntry> = {
  Reservas: (id) => ({
    label: "Reservas",
    to: `/restaurant/${id}/reservations`,
    icon: (
      <svg
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
        />
      </svg>
    ),
  }),
  "Menú Digital": (id) => ({
    label: "Menú",
    to: `/restaurant/${id}/menu`,
    icon: (
      <svg
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
        />
      </svg>
    ),
  }),
  Pedidos: (id) => ({
    label: "Pedidos",
    to: `/restaurant/${id}/orders`,
    icon: (
      <svg
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15"
        />
      </svg>
    ),
  }),
  Manager: (id) => ({
    label: "Propiedades",
    to: `/realestate/${id}/manager`,
    icon: (
      <svg
        className={iconClass}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    ),
  }),
};

const APP_SECTION_LABEL: Record<string, string> = {
  Restaurante: "Restaurante",
  Inmobiliaria: "Inmobiliaria",
};

function buildNavSections(instances: Instance[]): Array<{
  sectionLabel: string;
  items: NavEntry[];
}> {
  return instances
    .map((inst) => {
      const appName = inst.application.name;
      const sectionLabel = APP_SECTION_LABEL[appName] ?? appName;
      const items = inst.instanceServices
        .filter((is) => is.active)
        .map((is) => SERVICE_ROUTE_MAP[is.service.name]?.(inst.id))
        .filter((entry): entry is NavEntry => entry !== undefined);
      return { sectionLabel, items };
    })
    .filter((s) => s.items.length > 0);
}

// ─── Shared sidebar content ───────────────────────────────────────────────────
function SidebarContent({
  loading,
  sections,
  initials,
  user,
  onLinkClick,
  handleLogout,
}: {
  loading: boolean;
  sections: Array<{ sectionLabel: string; items: NavEntry[] }>;
  initials: string;
  user: { name?: string; company?: string; email?: string } | null;
  onLinkClick?: () => void;
  handleLogout: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">
            Mi Portal
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {loading ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-7 bg-zinc-800 rounded-md animate-pulse"
              />
            ))}
          </div>
        ) : sections.length === 0 ? (
          <p className="text-xs text-zinc-600 px-2">
            No tienes servicios activos.
          </p>
        ) : (
          sections.map(({ sectionLabel, items }) => (
            <div key={sectionLabel}>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-2 mb-1.5">
                {sectionLabel}
              </p>
              <div className="space-y-0.5">
                {items.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end
                    onClick={onLinkClick}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-indigo-600/15 text-indigo-400"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                      }`
                    }
                  >
                    {icon}
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-zinc-800 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md">
          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-300 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate">
              {user?.name ?? "—"}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">
              {user?.company || user?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-1 w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
            />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [access, setAccess] = useState<MyAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    portalApi
      .myAccess()
      .then(setAccess)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const sections = access ? buildNavSections(access.instances) : [];

  const initials = (user?.name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const closeDrawer = () => setMobileOpen(false);

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">
            Mi Portal
          </span>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="relative w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-100 focus:outline-none"
          aria-label="Abrir menú"
        >
          <div className="absolute w-5 h-4 flex flex-col justify-between items-center">
            <span
              className={`h-0.5 w-full bg-current rounded transform transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-1.75" : ""}`}
            />
            <span
              className={`h-0.5 w-full bg-current rounded transition-all duration-300 ${mobileOpen ? "opacity-0 scale-0" : ""}`}
            />
            <span
              className={`h-0.5 w-full bg-current rounded transform transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-2.25" : ""}`}
            />
          </div>
        </button>
      </header>

      {/* ── Mobile drawer backdrop ──────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      <div
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-zinc-900 flex flex-col transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          loading={loading}
          sections={sections}
          initials={initials}
          user={user ?? null}
          onLinkClick={closeDrawer}
          handleLogout={handleLogout}
        />
      </div>

      {/* ── Desktop sidebar (unchanged) ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex-col h-screen sticky top-0">
        <SidebarContent
          loading={loading}
          sections={sections}
          initials={initials}
          user={user ?? null}
          handleLogout={handleLogout}
        />
      </aside>
    </>
  );
}
