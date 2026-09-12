// customer-portal/src/pages/restaurant/MenuManager.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  menusApi,
  dishesApi,
  menuSectionsApi,
  type Menu,
  type Dish,
  type MenuSection,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Icon, Spinner } from "../../components/icons";
import { getErrorMessage } from "../../utils/errors";
import { ALLERGEN_LABELS } from "../../utils/allergens";

// ─── Category / section styling ────────────────────────────────────────────
// Las secciones (Entrante, Principal...) ya no son un enum fijo del sistema:
// son una lista propia por restaurante, gestionable desde esta misma página
// (crear, renombrar, reordenar, eliminar). Se siembran con el set habitual
// al contratar la app, pero cada restaurante la puede editar libremente.

// Paleta de colores estable por nombre, para distinguir secciones de un
// vistazo aunque el restaurante las haya renombrado o creado nuevas.
const CATEGORY_PALETTE = [
  "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20",
  "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 ring-1 ring-teal-200 dark:ring-teal-500/20",
  "bg-pink-50 dark:bg-pink-500/10 text-pink-700 dark:text-pink-400 ring-1 ring-pink-200 dark:ring-pink-500/20",
  "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-500/20",
  "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-500/20",
  "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-500/20",
  "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-1 ring-purple-200 dark:ring-purple-500/20",
  "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20",
];
const defaultBadge =
  "bg-zinc-100 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600/30";

function categoryStyle(category: string): string {
  if (!category) return defaultBadge;
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MenuManager() {
  // Instancia de Restaurante del cliente autenticado (ver hook para más detalle)
  const instance = useRestaurantInstance();
  const instId = instance?.id ?? 0;
  const slug = instance?.slug ?? "";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── State ──
  const [menus, setMenus] = useState<Menu[]>([]);
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Todos");

  // Menu CRUD state
  const [newMenuName, setNewMenuName] = useState("");
  const [creatingMenu, setCreatingMenu] = useState(false);
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingMenuName, setEditingMenuName] = useState("");
  const [deleteMenuConfirm, setDeleteMenuConfirm] = useState<Menu | null>(null);
  const [deletingMenu, setDeletingMenu] = useState(false);

  // Dish CRUD state (la edición de datos vive en DishForm; solo queda borrar)
  const [deleteDishConfirm, setDeleteDishConfirm] = useState<Dish | null>(null);
  const [deletingDish, setDeletingDish] = useState(false);

  // Section (management) CRUD state
  const [newSectionName, setNewSectionName] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionError, setSectionError] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  const [deleteSectionConfirm, setDeleteSectionConfirm] =
    useState<MenuSection | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  // ── Data loading ──
  const load = useCallback(async () => {
    if (!instId) return;
    try {
      const [menuData, sectionData] = await Promise.all([
        menusApi.list(instId),
        menuSectionsApi.list(instId),
      ]);
      setMenus(menuData);
      setSections(sectionData);
      if (menuData.length > 0) {
        // Si venimos de crear/editar un plato, se restaura la carta desde la
        // que se navegó (?menuId=), en vez de caer siempre en la primera.
        const paramId = Number(searchParams.get("menuId"));
        const fromParam = menuData.some((m) => m.id === paramId)
          ? paramId
          : null;
        setActiveMenuId((current) => current ?? fromParam ?? menuData[0].id);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived ──
  const activeMenu = menus.find((m) => m.id === activeMenuId) ?? null;

  const filteredDishes = (activeMenu?.dishes ?? []).filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q);
    const matchCat =
      categoryFilter === "Todos" || d.category === categoryFilter;
    return matchSearch && matchCat;
  });

  // ── Menu actions ──
  const createMenu = async () => {
    if (!newMenuName.trim()) return;
    setCreatingMenu(true);
    try {
      const menu = await menusApi.create(instId, newMenuName.trim());
      setMenus((prev) => [menu, ...prev]);
      setActiveMenuId(menu.id);
      setNewMenuName("");
    } finally {
      setCreatingMenu(false);
    }
  };

  const saveMenuRename = async (menuId: number) => {
    if (!editingMenuName.trim()) return;
    try {
      const updated = await menusApi.update(menuId, editingMenuName.trim());
      setMenus((prev) =>
        prev.map((m) => (m.id === menuId ? { ...m, name: updated.name } : m)),
      );
    } finally {
      setEditingMenuId(null);
    }
  };

  const deleteMenu = async () => {
    if (!deleteMenuConfirm) return;
    setDeletingMenu(true);
    try {
      await menusApi.remove(deleteMenuConfirm.id);
      const remaining = menus.filter((m) => m.id !== deleteMenuConfirm.id);
      setMenus(remaining);
      if (activeMenuId === deleteMenuConfirm.id) {
        setActiveMenuId(remaining[0]?.id ?? null);
      }
      setDeleteMenuConfirm(null);
    } finally {
      setDeletingMenu(false);
    }
  };

  // ── Dish actions ──
  const deleteDish = async () => {
    if (!deleteDishConfirm) return;
    setDeletingDish(true);
    try {
      await dishesApi.remove(deleteDishConfirm.id);
      setMenus((prev) =>
        prev.map((m) => ({
          ...m,
          dishes: m.dishes.filter((d) => d.id !== deleteDishConfirm.id),
        })),
      );
      setDeleteDishConfirm(null);
    } finally {
      setDeletingDish(false);
    }
  };

  // ── Section actions ──
  const createSection = async () => {
    const name = newSectionName.trim();
    if (!name) return;
    setAddingSection(true);
    setSectionError("");
    try {
      const section = await menuSectionsApi.create(instId, name);
      setSections((prev) => [...prev, section]);
      setNewSectionName("");
    } catch (err) {
      setSectionError(getErrorMessage(err, "No se pudo crear la sección"));
    } finally {
      setAddingSection(false);
    }
  };

  const saveSectionRename = async (section: MenuSection) => {
    const name = editingSectionName.trim();
    if (!name || name === section.name) {
      setEditingSectionId(null);
      return;
    }
    try {
      const updated = await menuSectionsApi.update(section.id, { name });
      setSections((prev) =>
        prev.map((s) => (s.id === section.id ? updated : s)),
      );
      // Los platos que usaban el nombre anterior se renombran solos en el
      // backend; reflejamos ese cambio también aquí para no tener que
      // recargar toda la carta.
      setMenus((prev) =>
        prev.map((m) => ({
          ...m,
          dishes: m.dishes.map((d) =>
            d.category === section.name ? { ...d, category: name } : d,
          ),
        })),
      );
      if (categoryFilter === section.name) setCategoryFilter(name);
    } catch (err) {
      setSectionError(getErrorMessage(err, "No se pudo renombrar la sección"));
    } finally {
      setEditingSectionId(null);
    }
  };

  const moveSection = async (section: MenuSection, direction: -1 | 1) => {
    const ordered = [...sections].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((s) => s.id === section.id);
    const swapWith = ordered[idx + direction];
    if (!swapWith) return;
    setReorderingId(section.id);
    try {
      const [a, b] = await Promise.all([
        menuSectionsApi.update(section.id, { position: swapWith.position }),
        menuSectionsApi.update(swapWith.id, { position: section.position }),
      ]);
      setSections((prev) =>
        prev.map((s) => {
          if (s.id === a.id) return a;
          if (s.id === b.id) return b;
          return s;
        }),
      );
    } finally {
      setReorderingId(null);
    }
  };

  const deleteSection = async () => {
    if (!deleteSectionConfirm) return;
    setDeletingSection(true);
    try {
      await menuSectionsApi.remove(deleteSectionConfirm.id);
      setSections((prev) =>
        prev.filter((s) => s.id !== deleteSectionConfirm.id),
      );
      // Los platos de esa sección quedan sin sección (no se borran).
      setMenus((prev) =>
        prev.map((m) => ({
          ...m,
          dishes: m.dishes.map((d) =>
            d.category === deleteSectionConfirm.name
              ? { ...d, category: "" }
              : d,
          ),
        })),
      );
      if (categoryFilter === deleteSectionConfirm.name) {
        setCategoryFilter("Todos");
      }
      setDeleteSectionConfirm(null);
    } finally {
      setDeletingSection(false);
    }
  };

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections],
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 lg:px-8 py-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Carta del restaurante
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {menus.length} {menus.length === 1 ? "carta" : "cartas"} ·{" "}
            {menus.reduce((n, m) => n + m.dishes.length, 0)} platos en total
          </p>
        </div>
        <button
          onClick={() =>
            activeMenu &&
            navigate(
              `/restaurant/${slug}/menu/dishes/new?menuId=${activeMenu.id}`,
            )
          }
          disabled={!activeMenu}
          className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl transition-colors"
        >
          <Icon name="plus" className="w-5 h-5" />
          Nuevo plato
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-zinc-500 text-sm">
          <Spinner className="w-5 h-5" /> Cargando cartas…
        </div>
      ) : (
        <>
          {/* ── Secciones de la carta: gestión (crear / renombrar / reordenar / eliminar) ── */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                Secciones de la carta
              </h2>
              <p className="text-xs text-zinc-600">
                Válidas para todas tus cartas y pedidos
              </p>
            </div>

            <div className="flex flex-wrap items-stretch gap-2.5">
              {orderedSections.map((section, idx) => (
                <div
                  key={section.id}
                  className="group flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-1 pr-1.5 py-1"
                >
                  {/* Reordenar */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={idx === 0 || reorderingId === section.id}
                      onClick={() => moveSection(section, -1)}
                      title="Mover antes"
                      className="p-0.5 text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                    >
                      <Icon
                        name="chevronUp"
                        className="w-3 h-3"
                        strokeWidth={3}
                      />
                    </button>
                    <button
                      type="button"
                      disabled={
                        idx === orderedSections.length - 1 ||
                        reorderingId === section.id
                      }
                      onClick={() => moveSection(section, 1)}
                      title="Mover después"
                      className="p-0.5 text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-20 disabled:hover:text-zinc-600 transition-colors"
                    >
                      <Icon
                        name="chevronDown"
                        className="w-3 h-3"
                        strokeWidth={3}
                      />
                    </button>
                  </div>

                  {editingSectionId === section.id ? (
                    <input
                      autoFocus
                      value={editingSectionName}
                      onChange={(e) => setEditingSectionName(e.target.value)}
                      onBlur={() => saveSectionRename(section)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveSectionRename(section);
                        if (e.key === "Escape") setEditingSectionId(null);
                      }}
                      className="w-32 bg-white dark:bg-zinc-900 border border-teal-500 rounded-lg px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
                    />
                  ) : (
                    <span
                      className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${categoryStyle(section.name)}`}
                    >
                      {section.name}
                    </span>
                  )}

                  {/* Editar / eliminar — visibles siempre en tablet (no dependen de hover) */}
                  {editingSectionId !== section.id && (
                    <div className="flex items-center gap-0.5 ml-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSectionId(section.id);
                          setEditingSectionName(section.name);
                        }}
                        title="Renombrar sección"
                        className="p-1.5 text-zinc-500 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-400/10 rounded-lg transition-colors"
                      >
                        <Icon name="pencil" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteSectionConfirm(section)}
                        title="Eliminar sección"
                        className="p-1.5 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <Icon name="close" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Añadir sección nueva */}
              <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950/50 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl px-2 py-1">
                <input
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createSection();
                  }}
                  placeholder="Ej. Especiales, Cumpleaños…"
                  className="w-40 bg-transparent px-1.5 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={createSection}
                  disabled={!newSectionName.trim() || addingSection}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  {addingSection ? (
                    <Spinner className="w-3.5 h-3.5" />
                  ) : (
                    <Icon
                      name="plus"
                      className="w-3.5 h-3.5"
                      strokeWidth={2.5}
                    />
                  )}
                  Añadir
                </button>
              </div>
            </div>
            {sectionError && (
              <p className="text-xs text-red-700 dark:text-red-400 mt-3">
                {sectionError}
              </p>
            )}
          </div>

          <div className="flex gap-6 items-start">
            {/* ── Left: menu list + new menu ── */}
            <div className="w-64 shrink-0 space-y-2 sticky top-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1 mb-3">
                Cartas
              </p>

              {menus.map((menu) => (
                <div key={menu.id} className="group relative">
                  {editingMenuId === menu.id ? (
                    <input
                      autoFocus
                      value={editingMenuName}
                      onChange={(e) => setEditingMenuName(e.target.value)}
                      onBlur={() => saveMenuRename(menu.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveMenuRename(menu.id);
                        if (e.key === "Escape") setEditingMenuId(null);
                      }}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-teal-500 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setActiveMenuId(menu.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        activeMenuId === menu.id
                          ? "bg-teal-600/15 text-teal-700 dark:text-teal-400"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span className="truncate block pr-10">{menu.name}</span>
                      <span className="text-xs text-zinc-600 font-normal">
                        {menu.dishes.length} plato
                        {menu.dishes.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                  )}

                  {/* Menu actions — visible on hover */}
                  {editingMenuId !== menu.id && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={() => {
                          setEditingMenuId(menu.id);
                          setEditingMenuName(menu.name);
                        }}
                        className="p-1.5 text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors"
                        title="Renombrar"
                      >
                        <Icon name="pencil" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteMenuConfirm(menu)}
                        className="p-1.5 text-zinc-600 hover:text-red-700 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* New menu input */}
              <div className="flex gap-1.5 pt-1">
                <input
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createMenu();
                  }}
                  placeholder="Nueva carta…"
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
                />
                <button
                  onClick={createMenu}
                  disabled={!newMenuName.trim() || creatingMenu}
                  className="px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:border-teal-400 dark:hover:border-teal-500/50 hover:bg-teal-50 dark:hover:bg-teal-500/10 disabled:opacity-40 text-zinc-600 dark:text-zinc-400 hover:text-teal-800 dark:hover:text-teal-300 rounded-xl transition-colors"
                >
                  {creatingMenu ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Icon name="plus" className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* ── Right: dish grid ── */}
            <div className="flex-1 min-w-0">
              {!activeMenu ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-16 text-center text-zinc-500 text-base">
                  Crea una carta para empezar a añadir platos.
                </div>
              ) : (
                <>
                  {/* Filters */}
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <div className="relative flex-1 min-w-72">
                      <Icon
                        name="search"
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
                      />
                      <input
                        type="text"
                        placeholder="Buscar plato…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setCategoryFilter("Todos")}
                        className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                          categoryFilter === "Todos"
                            ? "bg-teal-600 text-white"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        }`}
                      >
                        Todos
                      </button>
                      {orderedSections.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setCategoryFilter(s.name)}
                          className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                            categoryFilter === s.name
                              ? "bg-teal-600 text-white"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rejilla de platos */}
                  {filteredDishes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-2xl p-5 gap-2.5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              className="font-semibold text-base text-zinc-900 dark:text-zinc-100 truncate"
                              title={dish.name}
                            >
                              {dish.name}
                            </h3>
                            <span className="shrink-0 text-zinc-900 dark:text-zinc-100 font-bold tabular-nums">
                              {dish.price ? `${dish.price} €` : "—"}
                            </span>
                          </div>

                          {dish.category && (
                            <span
                              className={`self-start px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${categoryStyle(
                                dish.category,
                              )}`}
                            >
                              {dish.category}
                            </span>
                          )}

                          <p className="text-sm text-zinc-500 line-clamp-2 flex-1">
                            {dish.description || "Sin descripción"}
                          </p>

                          {dish.allergens && dish.allergens.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {dish.allergens.map((a) => (
                                <span
                                  key={a}
                                  title={ALLERGEN_LABELS[a]}
                                  className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-500/20 whitespace-nowrap"
                                >
                                  {ALLERGEN_LABELS[a]}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-1 border-t border-zinc-200 dark:border-zinc-800 pt-2.5 mt-1">
                            <button
                              onClick={() =>
                                navigate(
                                  `/restaurant/${slug}/menu/dishes/${dish.id}`,
                                )
                              }
                              className="p-2 text-zinc-500 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-400/10 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Icon name="pencil" className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteDishConfirm(dish)}
                              className="p-2 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Icon name="trash" className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-16 text-center text-zinc-500 text-base">
                      {search || categoryFilter !== "Todos"
                        ? "No se encontraron platos con ese filtro."
                        : "Esta carta no tiene platos. Añade el primero."}
                    </div>
                  )}

                  <p className="text-sm text-zinc-600 mt-4">
                    {filteredDishes.length} resultado
                    {filteredDishes.length !== 1 ? "s" : ""}
                    {categoryFilter !== "Todos" && (
                      <span className="ml-2 text-teal-700/70 dark:text-teal-500/60">
                        · filtrado por {categoryFilter}
                      </span>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Delete dish confirmation ── */}
      {deleteDishConfirm && (
        <ConfirmDialog
          title="¿Eliminar plato?"
          message={
            <>
              Se eliminará{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {deleteDishConfirm.name}
              </span>
              . Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          loading={deletingDish}
          onConfirm={deleteDish}
          onCancel={() => setDeleteDishConfirm(null)}
        />
      )}

      {/* ── Delete menu confirmation ── */}
      {deleteMenuConfirm && (
        <ConfirmDialog
          title="¿Eliminar carta?"
          message={
            <>
              Se eliminará{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {deleteMenuConfirm.name}
              </span>{" "}
              y todos sus platos. Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          loading={deletingMenu}
          onConfirm={deleteMenu}
          onCancel={() => setDeleteMenuConfirm(null)}
        />
      )}

      {/* ── Delete section confirmation ── */}
      {deleteSectionConfirm && (
        <ConfirmDialog
          title="¿Eliminar sección?"
          message={
            <>
              Se eliminará la sección{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {deleteSectionConfirm.name}
              </span>
              . Los platos que la usaban no se borran: quedarán sin sección
              asignada.
            </>
          }
          confirmLabel="Eliminar sección"
          loading={deletingSection}
          onConfirm={deleteSection}
          onCancel={() => setDeleteSectionConfirm(null)}
        />
      )}
    </div>
  );
}
