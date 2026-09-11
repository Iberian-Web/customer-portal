// customer-portal/src/pages/restaurant/MenuManager.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  menusApi,
  dishesApi,
  menuSectionsApi,
  type Menu,
  type Dish,
  type MenuSection,
  type Allergen,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import ConfirmDialog from "../../components/ConfirmDialog";

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

// ─── Allergen config (mirrors Allergen enum in schema.prisma) ─────────────────

const ALLERGEN_LABELS: Record<Allergen, string> = {
  GLUTEN: "Gluten",
  CRUSTACEOS: "Crustáceos",
  HUEVOS: "Huevos",
  PESCADO: "Pescado",
  CACAHUETES: "Cacahuetes",
  SOJA: "Soja",
  LACTEOS: "Lácteos",
  FRUTOS_DE_CASCARA: "Frutos de cáscara",
  APIO: "Apio",
  MOSTAZA: "Mostaza",
  SESAMO: "Sésamo",
  SULFITOS: "Sulfitos",
  ALTRAMUCES: "Altramuces",
  MOLUSCOS: "Moluscos",
};

const ALL_ALLERGENS = Object.keys(ALLERGEN_LABELS) as Allergen[];

// ─── Form types ───────────────────────────────────────────────────────────────

type DishForm = {
  name: string;
  description: string;
  price: string;
  category: string;
  allergens: Allergen[];
};

const emptyDishForm: DishForm = {
  name: "",
  description: "",
  price: "",
  category: "",
  allergens: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputClass =
  "w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} animate-spin`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      />
    </svg>
  );
}

// ─── Dish form modal ──────────────────────────────────────────────────────────

function DishModal({
  dish,
  menuId,
  sections,
  onClose,
  onSaved,
}: {
  dish: Dish | null;
  menuId: number;
  sections: MenuSection[];
  onClose: () => void;
  onSaved: (d: Dish) => void;
}) {
  const [form, setForm] = useState<DishForm>(
    dish
      ? {
          name: dish.name,
          description: dish.description,
          price: dish.price,
          category: dish.category,
          allergens: dish.allergens ?? [],
        }
      : { ...emptyDishForm, category: sections[0]?.name ?? "" },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = <K extends keyof DishForm>(k: K, v: DishForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleAllergen = (a: Allergen) => {
    setForm((f) => ({
      ...f,
      allergens: f.allergens.includes(a)
        ? f.allergens.filter((x) => x !== a)
        : [...f.allergens, a],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: form.price.trim(),
        category: form.category,
        allergens: form.allergens,
      };
      const saved = dish
        ? await dishesApi.update(dish.id, payload)
        : await dishesApi.create(menuId, payload);
      onSaved(saved);
    } catch (err) {
      setError(getErrorMessage(err, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl w-full max-w-lg p-6 shadow-lg space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {dish ? "Editar plato" : "Nuevo plato"}
        </h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
              Nombre <span className="text-teal-700 dark:text-teal-400">*</span>
            </label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Ej. Croquetas de jamón"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
              Descripción
            </label>
            <input
              className={inputClass}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Descripción breve"
            />
          </div>

          {/* Price + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                Precio (€)
              </label>
              <input
                className={inputClass}
                value={form.price}
                onChange={(e) => setField("price", e.target.value)}
                placeholder="9.50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block mb-1.5">
                Sección de la carta
              </label>
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
              >
                <option value="">Sin sección</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
                {/* Si el plato ya tenía una sección que ya no existe en la
                    lista gestionada, se mantiene visible para no perderla
                    en silencio al abrir el modal. */}
                {form.category &&
                  !sections.some((s) => s.name === form.category) && (
                    <option value={form.category}>
                      {form.category} (eliminada)
                    </option>
                  )}
              </select>
              <p className="text-[11px] text-zinc-600 mt-1.5">
                ¿Falta una sección? Créala arriba, en «Secciones de la carta».
              </p>
            </div>
          </div>

          {/* Allergens */}
          <div>
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block mb-2">
              Alérgenos
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ALLERGENS.map((a) => {
                const active = form.allergens.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAllergen(a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? "bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-500/40"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {ALLERGEN_LABELS[a]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving && <Spinner className="w-4 h-4" />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MenuManager() {
  // Instancia de Restaurante del cliente autenticado (ver hook para más detalle)
  const instance = useRestaurantInstance();
  const instId = instance?.id ?? 0;

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

  // Dish CRUD state
  const [dishModal, setDishModal] = useState<
    { open: true; dish: Dish | null } | { open: false }
  >({
    open: false,
  });
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
        setActiveMenuId((current) => current ?? menuData[0].id);
      }
    } finally {
      setLoading(false);
    }
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
  const handleDishSaved = (saved: Dish) => {
    setMenus((prev) =>
      prev.map((m) => {
        if (m.id !== activeMenuId) return m;
        const exists = m.dishes.some((d) => d.id === saved.id);
        return {
          ...m,
          dishes: exists
            ? m.dishes.map((d) => (d.id === saved.id ? saved : d))
            : [...m.dishes, saved],
        };
      }),
    );
    setDishModal({ open: false });
  };

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
          onClick={() => setDishModal({ open: true, dish: null })}
          disabled={!activeMenu}
          className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl transition-colors"
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
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 15.75l7.5-7.5 7.5 7.5"
                        />
                      </svg>
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
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
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
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteSectionConfirm(section)}
                        title="Eliminar sección"
                        className="p-1.5 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
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
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
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
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteMenuConfirm(menu)}
                        className="p-1.5 text-zinc-600 hover:text-red-700 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Eliminar"
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
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
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
                              onClick={() => setDishModal({ open: true, dish })}
                              className="p-2 text-zinc-500 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-400/10 rounded-lg transition-colors"
                              title="Editar"
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
                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteDishConfirm(dish)}
                              className="p-2 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Eliminar"
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
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                />
                              </svg>
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

      {/* ── Dish modal ── */}
      {dishModal.open && activeMenu && (
        <DishModal
          dish={dishModal.dish}
          menuId={activeMenu.id}
          sections={orderedSections}
          onClose={() => setDishModal({ open: false })}
          onSaved={handleDishSaved}
        />
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
