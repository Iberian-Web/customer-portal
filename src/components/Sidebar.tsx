// customer-portal/src/components/Sidebar.tsx
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import type { Instance } from "../api";
import { useAuth } from "../auth/useAuth";
import { slugify } from "../utils/slug";
import ThemeToggle from "./ThemeToggle";
import { Icon } from "./icons";

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

// ─── Service → route/icon registry ───────────────────────────────────────────
type NavEntry = {
  label: string;
  to: string;
  icon: React.ReactNode;
};

const iconClass = "w-4 h-4";

const SERVICE_ROUTE_MAP: Record<string, (slug: string) => NavEntry[]> = {
  Reservas: (slug) => [
    {
      label: "Reservas",
      to: `/restaurant/${slug}/reservations`,
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
    },
  ],
  "Menú Digital": (slug) => [
    {
      label: "Menú",
      to: `/restaurant/${slug}/menu`,
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
    },
  ],
  Pedidos: (slug) => [
    {
      label: "Pedidos",
      to: `/restaurant/${slug}/orders`,
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
    },
  ],
  Cocina: (slug) => [
    {
      label: "Cocina",
      to: `/restaurant/${slug}/kitchen`,
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
            d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z"
          />
        </svg>
      ),
    },
  ],
  Analíticas: (slug) => [
    {
      label: "Analíticas",
      to: `/restaurant/${slug}/analytics`,
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
            d="M3 3v16.5A1.5 1.5 0 004.5 21H21M7.5 15.75V9M12.75 15.75V6M18 15.75V12"
          />
        </svg>
      ),
    },
  ],
};

const APP_SECTION_LABEL: Record<string, string> = {
  Restaurante: "Restaurante",
};

function buildNavSections(
  instances: Instance[],
  companySlug: string,
  disabledServiceIds: number[],
): Array<{
  sectionLabel: string;
  items: NavEntry[];
}> {
  return instances
    .map((inst) => {
      const appName = inst.application.name;
      const sectionLabel = APP_SECTION_LABEL[appName] ?? appName;
      const items = inst.instanceServices
        .filter((is) => is.active && !disabledServiceIds.includes(is.serviceId))
        .flatMap(
          (is) => SERVICE_ROUTE_MAP[is.service.name]?.(companySlug) ?? [],
        );
      return { sectionLabel, items };
    })
    .filter((s) => s.items.length > 0);
}

// ─── Shared sidebar content ───────────────────────────────────────────────────
function SidebarContent({
  loading,
  sections,
  companyName,
  waiterName,
  onLinkClick,
  handleLogout,
  collapsed,
  onToggleCollapse,
}: {
  loading: boolean;
  sections: Array<{ sectionLabel: string; items: NavEntry[] }>;
  companyName: string;
  waiterName?: string;
  onLinkClick?: () => void;
  handleLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <>
      {/* Header / Company Name */}
      <div className="h-16 flex items-center justify-between gap-2 px-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        {!collapsed && (
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
            {companyName}
          </span>
        )}
        <div
          className={`flex items-center gap-1 ${collapsed ? "mx-auto" : "ml-auto"}`}
        >
          {!collapsed && <ThemeToggle className="shrink-0" />}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex w-8 h-8 items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors shrink-0"
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <Icon
                name="arrowLeft"
                className={`w-4 h-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="space-y-2 px-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-7 bg-zinc-100 dark:bg-zinc-800 rounded-md animate-pulse"
              />
            ))}
          </div>
        ) : sections.length === 0 ? (
          !collapsed && (
            <p className="text-xs text-zinc-600 px-2">
              No tienes servicios activos.
            </p>
          )
        ) : (
          sections.map(({ sectionLabel, items }) => (
            <div key={sectionLabel}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-2 mb-2">
                  {sectionLabel}
                </p>
              )}
              <div className="space-y-1">
                {items.map(({ to, label, icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end
                    onClick={onLinkClick}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${collapsed ? "justify-center" : ""} ${
                        isActive
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                      }`
                    }
                  >
                    {icon}
                    {!collapsed && label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Session actions */}
      <div className="px-3 py-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0 space-y-2">
        {collapsed && <ThemeToggle className="mx-auto" />}
        {waiterName && !collapsed && (
          <p
            className="px-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate"
            title={waiterName}
          >
            {waiterName}
          </p>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={`w-full px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 rounded-lg transition-colors text-left flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
          {!collapsed && "Cerrar sesión"}
        </button>
      </div>
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { user, access, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const sections = access
    ? buildNavSections(
        access.instances,
        slugify(access.company || access.name),
        access.disabledServiceIds,
      )
    : [];
  const companyName = user?.company || user?.name || "Mi Empresa";

  const closeDrawer = () => setMobileOpen(false);

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
          {companyName}
        </span>

        {/* Hamburger */}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="relative w-9 h-9 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none"
            aria-label="Abrir menú"
          >
            <div className="absolute w-5 h-4 flex flex-col justify-between items-center">
              <span
                className={`h-0.5 w-full bg-current rounded transform transition-all duration-300 ${
                  mobileOpen ? "rotate-45 translate-y-1.75" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full bg-current rounded transition-all duration-300 ${
                  mobileOpen ? "opacity-0 scale-0" : ""
                }`}
              />
              <span
                className={`h-0.5 w-full bg-current rounded transform transition-all duration-300 ${
                  mobileOpen ? "-rotate-45 -translate-y-2.25" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </header>

      {/* ── Mobile drawer backdrop ──────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer (opens from top, full width, auto height) ─────────── */}
      <div
        className={`md:hidden fixed top-0 left-0 right-0 z-50 w-full max-h-[85vh] bg-white dark:bg-zinc-900 flex flex-col rounded-b-2xl shadow-xl overflow-hidden transform origin-top transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <SidebarContent
          loading={isLoading}
          sections={sections}
          companyName={companyName}
          waiterName={access?.waiterName}
          onLinkClick={closeDrawer}
          handleLogout={handleLogout}
        />
      </div>

      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col h-screen sticky top-0 transition-all duration-200 ${
          collapsed ? "w-18" : "w-56"
        }`}
      >
        <SidebarContent
          loading={isLoading}
          sections={sections}
          companyName={companyName}
          waiterName={access?.waiterName}
          handleLogout={handleLogout}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>
    </>
  );
}
