// customer-portal/src/pages/restaurant/MenuManager.tsx
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  menusApi,
  dishesApi,
  type Menu,
  type Dish,
  type DishCategory,
  type Allergen,
} from "../../api";

// ─── Category config (mirrors DishCategory enum in schema.prisma) ─────────────

type CategoryMeta = {
  label: string;
  style: string;
};

const CATEGORY_META: Record<DishCategory, CategoryMeta> = {
  ENTRANTE: {
    label: "Entrante",
    style: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  },
  PRINCIPAL: {
    label: "Principal",
    style: "bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20",
  },
  POSTRE: {
    label: "Postre",
    style: "bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20",
  },
  BEBIDA: {
    label: "Bebida",
    style: "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20",
  },
  GUARNICION: {
    label: "Guarnición",
    style: "bg-green-500/10 text-green-400 ring-1 ring-green-500/20",
  },
  TAPA: {
    label: "Tapa",
    style: "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20",
  },
  MENU_CERRADO: {
    label: "Menú cerrado",
    style: "bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20",
  },
};

const CATEGORIES = Object.keys(CATEGORY_META) as DishCategory[];
const defaultBadge = "bg-zinc-700/40 text-zinc-400 ring-1 ring-zinc-600/30";

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
  category: DishCategory | "";
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
  "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ className = "w-3.5 h-3.5" }: { className?: string }) {
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
  onClose,
  onSaved,
}: {
  dish: Dish | null;
  menuId: number;
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
      : emptyDishForm,
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
        category: (form.category || "PRINCIPAL") as DishCategory,
        allergens: form.allergens,
      };
      const saved = dish
        ? await dishesApi.update(dish.id, payload)
        : await dishesApi.create(menuId, payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
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
        className="relative bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6 shadow-lg space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-zinc-100">
          {dish ? "Editar plato" : "Nuevo plato"}
        </h3>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">
              Nombre <span className="text-teal-400">*</span>
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
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">
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
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">
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
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                Categoría
              </label>
              <select
                className={inputClass}
                value={form.category}
                onChange={(e) =>
                  setField("category", e.target.value as DishCategory | "")
                }
              >
                <option value="">Sin categoría</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Allergens */}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-2">
              Alérgenos
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_ALLERGENS.map((a) => {
                const active = form.allergens.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAllergen(a)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40"
                        : "bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
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
          <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving && <Spinner />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MenuManager() {
  // Route: /restaurant/:instanceId/menu
  const { instanceId } = useParams<{ instanceId: string }>();
  const instId = Number(instanceId);

  // ── State ──
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DishCategory | "Todos">(
    "Todos",
  );

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

  // ── Data loading ──
  const load = useCallback(async () => {
    if (!instId) return;
    try {
      const data = await menusApi.list(instId);
      setMenus(data);
      if (data.length > 0) {
        setActiveMenuId((current) => current ?? data[0].id);
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

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Carta del restaurante
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {menus.length} {menus.length === 1 ? "carta" : "cartas"} ·{" "}
            {menus.reduce((n, m) => n + m.dishes.length, 0)} platos en total
          </p>
        </div>
        <button
          onClick={() => setDishModal({ open: true, dish: null })}
          disabled={!activeMenu}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Nuevo plato
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-zinc-500 text-sm">
          <Spinner className="w-4 h-4" /> Cargando cartas…
        </div>
      ) : (
        <div className="flex gap-6">
          {/* ── Left: menu list + new menu ── */}
          <div className="w-52 shrink-0 space-y-2">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-1 mb-3">
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
                    className="w-full bg-zinc-800 border border-teal-500 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setActiveMenuId(menu.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeMenuId === menu.id
                        ? "bg-teal-600/15 text-teal-400"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="truncate block pr-10">{menu.name}</span>
                    <span className="text-[10px] text-zinc-600 font-normal">
                      {menu.dishes.length} plato
                      {menu.dishes.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                )}

                {/* Menu actions — visible on hover */}
                {editingMenuId !== menu.id && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        setEditingMenuId(menu.id);
                        setEditingMenuName(menu.name);
                      }}
                      className="p-1 text-zinc-600 hover:text-zinc-300 rounded transition-colors"
                      title="Renombrar"
                    >
                      <svg
                        className="w-3 h-3"
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
                      className="p-1 text-zinc-600 hover:text-red-400 rounded transition-colors"
                      title="Eliminar"
                    >
                      <svg
                        className="w-3 h-3"
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
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
              />
              <button
                onClick={createMenu}
                disabled={!newMenuName.trim() || creatingMenu}
                className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 hover:border-teal-500/50 hover:bg-teal-500/10 disabled:opacity-40 text-zinc-400 hover:text-teal-300 rounded-lg transition-colors"
              >
                {creatingMenu ? (
                  <Spinner className="w-3 h-3" />
                ) : (
                  <svg
                    className="w-3 h-3"
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

          {/* ── Right: dish table ── */}
          <div className="flex-1 min-w-0">
            {!activeMenu ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-12 text-center text-zinc-500 text-sm">
                Crea una carta para empezar a añadir platos.
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-48">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
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
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setCategoryFilter("Todos")}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        categoryFilter === "Todos"
                          ? "bg-teal-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      Todos
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          categoryFilter === cat
                            ? "bg-teal-600 text-white"
                            : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                        }`}
                      >
                        {CATEGORY_META[cat].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[26%]" />
                      <col className="w-[16%]" />
                      <col className="w-[10%]" />
                      <col className="w-[16%]" />
                      <col className="w-[8%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-zinc-800 text-left">
                        {[
                          "Nombre",
                          "Descripción",
                          "Categoría",
                          "Precio",
                          "Alérgenos",
                          "",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {filteredDishes.length > 0 ? (
                        filteredDishes.map((dish) => (
                          <tr
                            key={dish.id}
                            className="hover:bg-zinc-800/50 transition-colors"
                          >
                            <td className="px-4 py-3.5">
                              <span
                                className="block font-medium text-zinc-200 truncate"
                                title={dish.name}
                              >
                                {dish.name}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className="block text-xs text-zinc-400 truncate"
                                title={dish.description}
                              >
                                {dish.description || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {dish.category ? (
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${
                                    CATEGORY_META[dish.category]?.style ??
                                    defaultBadge
                                  }`}
                                >
                                  {CATEGORY_META[dish.category]?.label ??
                                    dish.category}
                                </span>
                              ) : (
                                <span className="text-zinc-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-zinc-200 font-medium tabular-nums">
                                {dish.price ? `${dish.price} €` : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {dish.allergens && dish.allergens.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {dish.allergens.slice(0, 3).map((a) => (
                                    <span
                                      key={a}
                                      title={ALLERGEN_LABELS[a]}
                                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20 whitespace-nowrap"
                                    >
                                      {ALLERGEN_LABELS[a]}
                                    </span>
                                  ))}
                                  {dish.allergens.length > 3 && (
                                    <span className="text-[10px] text-zinc-500">
                                      +{dish.allergens.length - 3}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() =>
                                    setDishModal({ open: true, dish })
                                  }
                                  className="p-1.5 text-zinc-500 hover:text-teal-400 hover:bg-teal-400/10 rounded-md transition-colors"
                                  title="Editar"
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
                                  onClick={() => setDeleteDishConfirm(dish)}
                                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
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
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-12 text-center text-zinc-500 text-sm"
                          >
                            {search || categoryFilter !== "Todos"
                              ? "No se encontraron platos con ese filtro."
                              : "Esta carta no tiene platos. Añade el primero."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-zinc-600 mt-3">
                  {filteredDishes.length} resultado
                  {filteredDishes.length !== 1 ? "s" : ""}
                  {categoryFilter !== "Todos" && (
                    <span className="ml-2 text-teal-500/60">
                      · filtrado por{" "}
                      {CATEGORY_META[categoryFilter as DishCategory]?.label}
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Dish modal ── */}
      {dishModal.open && activeMenu && (
        <DishModal
          dish={dishModal.dish}
          menuId={activeMenu.id}
          onClose={() => setDishModal({ open: false })}
          onSaved={handleDishSaved}
        />
      )}

      {/* ── Delete dish confirmation ── */}
      {deleteDishConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setDeleteDishConfirm(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-100 mb-2">
              ¿Eliminar plato?
            </h3>
            <p className="text-sm text-zinc-500 mb-6">
              Se eliminará{" "}
              <span className="text-zinc-300 font-medium">
                {deleteDishConfirm.name}
              </span>
              . Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteDishConfirm(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={deleteDish}
                disabled={deletingDish}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
              >
                {deletingDish && <Spinner />}
                {deletingDish ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete menu confirmation ── */}
      {deleteMenuConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setDeleteMenuConfirm(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-100 mb-2">
              ¿Eliminar carta?
            </h3>
            <p className="text-sm text-zinc-500 mb-6">
              Se eliminará{" "}
              <span className="text-zinc-300 font-medium">
                {deleteMenuConfirm.name}
              </span>{" "}
              y todos sus platos. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteMenuConfirm(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={deleteMenu}
                disabled={deletingMenu}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
              >
                {deletingMenu && <Spinner />}
                {deletingMenu ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
