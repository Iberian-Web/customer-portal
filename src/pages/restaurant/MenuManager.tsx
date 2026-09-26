// customer-portal/src/pages/restaurant/MenuManager.tsx
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
// Las secciones (Entrante, Principal...) son una lista propia por
// restaurante, editable desde esta página, no un enum fijo del sistema.

// Paleta de colores estable por nombre, para distinguir secciones aunque
// se hayan renombrado o creado nuevas.
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

// ─── Fila horizontal con scroll táctil/de ratón ────────────────────────────
// En vez de dejar que las secciones salten de línea y ocupen media pantalla,
// se muestran en una sola línea que se desplaza arrastrando (dedo o ratón)
// o con los botones </>, sin la barra de scroll nativa (ver .no-scrollbar).

function HorizontalScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Estado del arrastre con ratón, en un ref (no state) para no volver a
  // renderizar en cada pixel de movimiento.
  const drag = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const scrollBy = (dx: number) =>
    ref.current?.scrollBy({ left: dx, behavior: "smooth" });

  // En táctil el navegador ya hace scroll nativo con el dedo — esto es solo
  // para poder arrastrar con el ratón (o un lápiz), igual que en móvil.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    drag.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const state = drag.current;
    if (!el || !state.active) return;
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 3) state.moved = true;
    el.scrollLeft = state.startScrollLeft - dx;
  };

  const endDrag = () => {
    drag.current.active = false;
  };

  // Tras arrastrar, soltar el ratón encima de un botón/chip no debe activar
  // su clic (arrastrar no es "hacer clic"); se traga solo ese primer clic.
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => scrollBy(-240)}
        title="Desplazar a la izquierda"
        aria-label="Desplazar a la izquierda"
        className="shrink-0 p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <Icon name="chevronLeft" className="w-4 h-4" strokeWidth={2.5} />
      </button>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className="flex items-stretch gap-2.5 flex-nowrap overflow-x-auto no-scrollbar scroll-smooth cursor-grab active:cursor-grabbing select-none"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(240)}
        title="Desplazar a la derecha"
        aria-label="Desplazar a la derecha"
        className="shrink-0 p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <Icon name="chevronRight" className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
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
  const queryClient = useQueryClient();
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("Todos");

  // Menu CRUD state (UI only — el estado de "en curso" vive en cada mutation)
  const [newMenuName, setNewMenuName] = useState("");
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editingMenuName, setEditingMenuName] = useState("");
  const [deleteMenuConfirm, setDeleteMenuConfirm] = useState<Menu | null>(null);

  // Dish CRUD state (la edición de datos vive en DishForm; solo queda borrar)
  const [deleteDishConfirm, setDeleteDishConfirm] = useState<Dish | null>(null);

  // Section (management) CRUD state
  const [newSectionName, setNewSectionName] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [sectionError, setSectionError] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  const [deleteSectionConfirm, setDeleteSectionConfirm] =
    useState<MenuSection | null>(null);
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  // ── Data loading ──
  const { data: menus = [], isLoading: loading } = useQuery({
    queryKey: ["menus", instId],
    queryFn: () => menusApi.list(instId),
    enabled: !!instId,
  });
  const { data: sections = [] } = useQuery({
    queryKey: ["menuSections", instId],
    queryFn: () => menuSectionsApi.list(instId),
    enabled: !!instId,
  });

  const invalidateMenus = () =>
    queryClient.invalidateQueries({ queryKey: ["menus", instId] });
  const invalidateSections = () =>
    queryClient.invalidateQueries({ queryKey: ["menuSections", instId] });

  // Elige la carta activa: mantiene la actual si existe; si no, cae en la
  // de la URL (?menuId=) o la primera. Va en el render, no en un efecto:
  // es adaptar estado a datos ya cargados.
  if (menus.length === 0) {
    if (activeMenuId !== null) setActiveMenuId(null);
  } else if (!menus.some((m) => m.id === activeMenuId)) {
    const paramId = Number(searchParams.get("menuId"));
    const fromParam = menus.some((m) => m.id === paramId) ? paramId : null;
    setActiveMenuId(fromParam ?? menus[0].id);
  }

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
  const createMenuMutation = useMutation({
    mutationFn: (name: string) => menusApi.create(instId, name),
    onSuccess: (menu) => {
      void invalidateMenus();
      setActiveMenuId(menu.id);
      setNewMenuName("");
    },
  });
  const createMenu = () => {
    const name = newMenuName.trim();
    if (name) createMenuMutation.mutate(name);
  };

  const renameMenuMutation = useMutation({
    mutationFn: ({ menuId, name }: { menuId: number; name: string }) =>
      menusApi.update(menuId, name),
    onSuccess: () => void invalidateMenus(),
    onSettled: () => setEditingMenuId(null),
  });
  const saveMenuRename = (menuId: number) => {
    const name = editingMenuName.trim();
    if (!name) return; // como el original: si queda vacío, no se cierra el campo
    renameMenuMutation.mutate({ menuId, name });
  };

  const deleteMenuMutation = useMutation({
    mutationFn: (menuId: number) => menusApi.remove(menuId),
    onSuccess: () => {
      void invalidateMenus();
      setDeleteMenuConfirm(null);
    },
  });
  const deleteMenu = () => {
    if (deleteMenuConfirm) deleteMenuMutation.mutate(deleteMenuConfirm.id);
  };

  // ── Dish actions ──
  const deleteDishMutation = useMutation({
    mutationFn: (dishId: number) => dishesApi.remove(dishId),
    onSuccess: () => {
      void invalidateMenus();
      setDeleteDishConfirm(null);
    },
  });
  const deleteDish = () => {
    if (deleteDishConfirm) deleteDishMutation.mutate(deleteDishConfirm.id);
  };

  // ── Section actions ──
  const createSectionMutation = useMutation({
    mutationFn: (name: string) => menuSectionsApi.create(instId, name),
    onSuccess: () => {
      void invalidateSections();
      setNewSectionName("");
      setSectionError("");
      setAddingSection(false);
    },
    onError: (err) =>
      setSectionError(getErrorMessage(err, "No se pudo crear la sección")),
  });
  const createSection = () => {
    const name = newSectionName.trim();
    if (name) createSectionMutation.mutate(name);
  };

  const renameSectionMutation = useMutation({
    mutationFn: ({
      id,
      newName,
    }: {
      id: number;
      oldName: string;
      newName: string;
    }) => menuSectionsApi.update(id, { name: newName }),
    onSuccess: (_updated, { oldName, newName }) => {
      void invalidateSections();
      // Los platos que usaban el nombre anterior se renombran solos en el
      // backend; con invalidar "menus" basta para reflejarlo aquí también.
      void invalidateMenus();
      setCategoryFilter((current) => (current === oldName ? newName : current));
    },
    onError: (err) =>
      setSectionError(getErrorMessage(err, "No se pudo renombrar la sección")),
    onSettled: () => setEditingSectionId(null),
  });
  const saveSectionRename = (section: MenuSection) => {
    const newName = editingSectionName.trim();
    if (!newName || newName === section.name) {
      setEditingSectionId(null);
      return;
    }
    renameSectionMutation.mutate({
      id: section.id,
      oldName: section.name,
      newName,
    });
  };

  const moveSectionMutation = useMutation({
    mutationFn: async ({
      section,
      swapWith,
    }: {
      section: MenuSection;
      swapWith: MenuSection;
    }) => {
      await Promise.all([
        menuSectionsApi.update(section.id, { position: swapWith.position }),
        menuSectionsApi.update(swapWith.id, { position: section.position }),
      ]);
    },
    onSuccess: () => void invalidateSections(),
  });
  const moveSection = (section: MenuSection, direction: -1 | 1) => {
    const ordered = [...sections].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((s) => s.id === section.id);
    const swapWith = ordered[idx + direction];
    if (!swapWith) return;
    setReorderingId(section.id);
    moveSectionMutation.mutate(
      { section, swapWith },
      { onSettled: () => setReorderingId(null) },
    );
  };

  const deleteSectionMutation = useMutation({
    mutationFn: (section: MenuSection) => menuSectionsApi.remove(section.id),
    onSuccess: (_data, section) => {
      void invalidateSections();
      // Los platos de esa sección quedan sin sección (no se borran); lo
      // refleja el propio refetch de "menus".
      void invalidateMenus();
      setCategoryFilter((current) =>
        current === section.name ? "Todos" : current,
      );
      setDeleteSectionConfirm(null);
    },
  });
  const deleteSection = () => {
    if (deleteSectionConfirm)
      deleteSectionMutation.mutate(deleteSectionConfirm);
  };

  const orderedSections = useMemo(
    () => [...sections].sort((a, b) => a.position - b.position),
    [sections],
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 lg:px-8 py-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
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
          className="flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl transition-colors"
        >
          <Icon name="plus" className="w-5 h-5" />
          Plato
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-zinc-500 text-sm">
          <Spinner className="w-5 h-5" /> Cargando cartas…
        </div>
      ) : (
        <>
          {/* ── Secciones de la carta: gestión (crear / renombrar / reordenar / eliminar) ── */}
          <div className="mb-6">
            <HorizontalScroller>
              {/* Añadir sección: un único chip, siempre el primero de la
                  fila. En reposo es solo un "+"; al pulsarlo se convierte
                  en el mismo sitio en un campo de texto compacto, sin abrir
                  ninguna fila ni bloque adicional. */}
              {addingSection ? (
                <div className="shrink-0 flex items-center gap-1.5 bg-teal-50/60 dark:bg-teal-500/5 border border-dashed border-teal-300 dark:border-teal-500/30 rounded-xl pl-2.5 pr-1 py-1">
                  <input
                    autoFocus
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createSection();
                      if (e.key === "Escape") setAddingSection(false);
                    }}
                    placeholder="Nombre de la sección…"
                    className="w-36 bg-transparent px-1 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={createSection}
                    disabled={
                      !newSectionName.trim() || createSectionMutation.isPending
                    }
                    title="Añadir sección"
                    aria-label="Añadir sección"
                    className="shrink-0 p-1.5 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-500/10 disabled:opacity-40 rounded-lg transition-colors"
                  >
                    {createSectionMutation.isPending ? (
                      <Spinner className="w-4 h-4" />
                    ) : (
                      <Icon
                        name="check"
                        className="w-4 h-4"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingSection(false)}
                    title="Cancelar"
                    aria-label="Cancelar"
                    className="shrink-0 p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSection(true)}
                  title="Nueva sección"
                  aria-label="Nueva sección"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-500/10 text-zinc-600 dark:text-zinc-400 hover:text-teal-700 dark:hover:text-teal-400 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-teal-400 dark:hover:border-teal-500/40 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Icon name="plus" className="w-4 h-4" strokeWidth={2.5} />
                  Sección
                </button>
              )}

              {orderedSections.map((section, idx) => (
                <div
                  key={section.id}
                  className="shrink-0 group flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-300 dark:border-zinc-700 rounded-xl pl-1 pr-1.5 py-1"
                >
                  {/* Reordenar */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={idx === 0 || reorderingId === section.id}
                      onClick={() => moveSection(section, -1)}
                      title="Mover antes"
                      aria-label="Mover antes"
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
                      aria-label="Mover después"
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
                        aria-label="Renombrar sección"
                        className="p-1.5 text-zinc-500 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-400/10 rounded-lg transition-colors"
                      >
                        <Icon name="pencil" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteSectionConfirm(section)}
                        title="Eliminar"
                        aria-label="Eliminar"
                        className="p-1.5 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <Icon name="close" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </HorizontalScroller>
            {sectionError && (
              <p className="text-xs text-red-700 dark:text-red-400 mt-3">
                {sectionError}
              </p>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* ── Left: menu list + new menu ── */}
            <div className="w-full lg:w-64 lg:shrink-0 space-y-2 lg:sticky lg:top-6">
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

                  {/* Menu actions — siempre visibles en táctil/tablet;
                      en escritorio aparecen al pasar el ratón. */}
                  {editingMenuId !== menu.id && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingMenuId(menu.id);
                          setEditingMenuName(menu.name);
                        }}
                        className="p-1.5 text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-lg transition-colors"
                        title="Renombrar"
                        aria-label="Renombrar"
                      >
                        <Icon name="pencil" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteMenuConfirm(menu)}
                        className="p-1.5 text-zinc-600 hover:text-red-700 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Eliminar"
                        aria-label="Eliminar"
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
                  disabled={!newMenuName.trim() || createMenuMutation.isPending}
                  className="px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:border-teal-400 dark:hover:border-teal-500/50 hover:bg-teal-50 dark:hover:bg-teal-500/10 disabled:opacity-40 text-zinc-600 dark:text-zinc-400 hover:text-teal-800 dark:hover:text-teal-300 rounded-xl transition-colors"
                >
                  {createMenuMutation.isPending ? (
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
                    <div className="relative w-full sm:flex-1 sm:min-w-72">
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
                    <div className="relative shrink-0">
                      <Icon
                        name="filter"
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
                      />
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        title="Filtrar por sección"
                        className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-9 py-3 text-base font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30 transition-colors cursor-pointer"
                      >
                        <option value="Todos">Filtrar por…</option>
                        {orderedSections.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <Icon
                        name="chevronDown"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
                      />
                    </div>
                  </div>

                  {/* Rejilla de platos */}
                  {filteredDishes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
                      {filteredDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 rounded-2xl p-5 gap-2.5 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              className="min-w-0 font-semibold text-base text-zinc-900 dark:text-zinc-100 truncate"
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
                              aria-label="Editar"
                            >
                              <Icon name="pencil" className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteDishConfirm(dish)}
                              className="p-2 text-zinc-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors"
                              title="Eliminar"
                              aria-label="Eliminar"
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
          loading={deleteDishMutation.isPending}
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
          loading={deleteMenuMutation.isPending}
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
          confirmLabel="Eliminar"
          loading={deleteSectionMutation.isPending}
          onConfirm={deleteSection}
          onCancel={() => setDeleteSectionConfirm(null)}
        />
      )}
    </div>
  );
}
