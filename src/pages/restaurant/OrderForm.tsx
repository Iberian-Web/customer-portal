// customer-portal/src/pages/restaurant/OrderForm.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ordersApi,
  menusApi,
  type Order,
  type OrderStatus,
  type OrderCreate,
  type Menu,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import { useAuth } from "../../auth/useAuth";
import ConfirmDialog from "../../components/ConfirmDialog";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Nuevo · sin enviar",
  IN_PROGRESS: "En cocina",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING:
    "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/20",
  IN_PROGRESS:
    "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/20",
  READY:
    "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/20",
  DELIVERED:
    "bg-zinc-100 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-600/30",
  CANCELLED:
    "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/20",
};

// Sentinel para "todas las categorías" en el filtro de la carta.
const ALL_CATEGORIES = "__TODOS__";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function money(n: number): string {
  return `${n.toFixed(2)} €`;
}

let itemKeySeq = 0;
function newItemKey() {
  itemKeySeq += 1;
  return `item-${itemKeySeq}-${Date.now()}`;
}

// ─── Small shared UI bits (mismo estilo que CustomerForm) ─────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
      {children}
    </h2>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block mb-2">
        {label}
        {required && (
          <span className="text-teal-700 dark:text-teal-400 ml-0.5">*</span>
        )}
        {hint && <span className="text-zinc-600 ml-1 font-normal">{hint}</span>}
      </label>
      {children}
      {typeof error === "string" && error && (
        <p className="mt-1.5 text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
          <svg
            className="w-3 h-3 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

const getInputClass = (hasError?: boolean | string) =>
  `w-full bg-zinc-100 dark:bg-zinc-800 border rounded-xl px-4 py-3 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 transition-colors ${
    hasError
      ? "border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
      : "border-zinc-300 dark:border-zinc-700 focus:border-teal-500 focus:ring-teal-500/30"
  }`;

// ─── Form types ───────────────────────────────────────────────────────────────

type FormItem = {
  key: string;
  dishName: string;
  quantity: string;
  unitPrice: string;
};

type FormData = {
  tableNumber: string;
  notes: string;
  items: FormItem[];
};

type FormErrors = Partial<Record<"tableNumber" | "items", string>>;

const emptyForm: FormData = {
  tableNumber: "",
  notes: "",
  items: [],
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function OrderForm() {
  const { orderId } = useParams<{ orderId?: string }>();
  const navigate = useNavigate();
  const instance = useRestaurantInstance();
  const { access } = useAuth();
  const id = instance?.id ?? 0;
  const slug = instance?.slug ?? "";
  const isEdit = !!orderId && orderId !== "new";
  const goBack = () => navigate(`/restaurant/${slug}/orders`);

  // ── Data state ──
  const [order, setOrder] = useState<Order | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Form state ──
  const [form, setForm] = useState<FormData>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState<"save" | "send" | false>(false);
  const [error, setError] = useState<string | null>(null);

  // ── Delete state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Dish picker state ──
  const [dishSearch, setDishSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");

  // ─ Load data ─
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [menuData, existing] = await Promise.all([
        menusApi.list(id).catch(() => []),
        isEdit ? ordersApi.get(Number(orderId)) : Promise.resolve(null),
      ]);

      setMenus(menuData);

      if (existing) {
        setOrder(existing);
        setForm({
          tableNumber: String(existing.tableNumber),
          notes: existing.notes,
          items: existing.items.map((it) => ({
            key: newItemKey(),
            dishName: it.dishName,
            quantity: String(it.quantity),
            unitPrice: String(it.unitPrice),
          })),
        });
      }
    } catch (loadError: unknown) {
      if (
        isEdit &&
        loadError instanceof Error &&
        "status" in loadError &&
        (loadError as { status?: number }).status === 404
      ) {
        navigate(`/restaurant/${slug}/orders`, { replace: true });
        return;
      }
      setError(getErrorMessage(loadError, "Error al cargar el pedido"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Dish picker ───────────────────────────────────────────────────────────

  /** Añade un plato de la carta al pedido; si ya estaba, incrementa su cantidad. */
  const handleAddDish = (dishName: string, unitPrice: string) => {
    setForm((f) => {
      const existing = f.items.find((it) => it.dishName === dishName);
      if (existing) {
        return {
          ...f,
          items: f.items.map((it) =>
            it.key === existing.key
              ? { ...it, quantity: String((Number(it.quantity) || 0) + 1) }
              : it,
          ),
        };
      }
      return {
        ...f,
        items: [
          ...f.items,
          { key: newItemKey(), dishName, quantity: "1", unitPrice },
        ],
      };
    });
    setFieldErrors((fe) => ({ ...fe, items: undefined }));
  };

  const handleAddCustom = () => {
    const qty = Number(customQty);
    if (!customName.trim() || !Number.isFinite(qty) || qty <= 0) return;

    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        {
          key: newItemKey(),
          dishName: customName.trim(),
          quantity: String(qty),
          unitPrice: customPrice || "0",
        },
      ],
    }));
    setFieldErrors((fe) => ({ ...fe, items: undefined }));
    setCustomName("");
    setCustomPrice("");
    setCustomQty("1");
    setCustomOpen(false);
  };

  const updateItemQty = (key: string, quantity: string) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it) => (it.key === key ? { ...it, quantity } : it)),
    }));
  };

  const removeItem = (key: string) => {
    setForm((f) => ({ ...f, items: f.items.filter((it) => it.key !== key) }));
  };

  const total = form.items.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  // Todos los platos de todas las cartas del restaurante, sin agrupar por carta
  const allDishes = useMemo(() => menus.flatMap((m) => m.dishes), [menus]);

  // Secciones de carta realmente en uso, calculadas de forma dinámica a
  // partir de los platos existentes — no hay una lista fija: si en "Carta"
  // se crea una sección nueva ("Especiales", "Cumpleaños"...), aparece aquí
  // automáticamente en cuanto tenga algún plato.
  const presentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const d of allDishes) {
      const c = (d.category || "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [allDishes]);

  // Platos visibles según la sección activa + la búsqueda
  const dishIndex = useMemo(() => {
    const q = dishSearch.trim().toLowerCase();
    return allDishes.filter((d) => {
      const matchesCategory =
        activeCategory === ALL_CATEGORIES || d.category === activeCategory;
      const matchesSearch = !q || d.name.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allDishes, activeCategory, dishSearch]);

  const hasAnyDishes = allDishes.length > 0;

  // ── Validation + submit ──────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: FormErrors = {};
    const tableNumber = Number(form.tableNumber);
    if (!tableNumber || tableNumber <= 0) {
      errs.tableNumber = "Introduce un número de mesa válido.";
    }
    if (form.items.length === 0) {
      errs.items = "Añade al menos un plato al pedido.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /**
   * Guarda el pedido. `sendToKitchen`:
   *  - En un pedido nuevo: lo crea y lo manda directamente a cocina
   *    (IN_PROGRESS) en la misma acción, sin tener que volver al listado.
   *  - Al editar un pedido que seguía "Nuevo" (PENDING), lo guarda y además
   *    lo envía a cocina.
   * El camarero/a NUNCA se envía desde este formulario: lo asocia el
   * backend a partir de la sesión de quien ha iniciado sesión.
   */
  const submit = async (sendToKitchen: boolean) => {
    if (!validate()) return;

    const payload: OrderCreate = {
      tableNumber: Number(form.tableNumber),
      notes: form.notes.trim() || undefined,
      items: form.items.map((it) => ({
        dishName: it.dishName,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      })),
      ...(sendToKitchen && !isEdit ? { sendToKitchen: true } : {}),
    };

    setSaving(sendToKitchen ? "send" : "save");
    setError(null);
    try {
      if (isEdit) {
        await ordersApi.update(Number(orderId), payload);
        if (sendToKitchen && order?.status === "PENDING") {
          await ordersApi.updateStatus(Number(orderId), "IN_PROGRESS");
        }
      } else {
        await ordersApi.create(id, payload);
      }
      goBack();
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError, "Error al guardar el pedido"));
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!order) return;
    setDeleting(true);
    try {
      await ordersApi.remove(order.id);
      goBack();
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "Error al eliminar el pedido"));
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Se puede "enviar a cocina" directamente si es un pedido nuevo, o si es
  // una edición de un pedido que todavía no se había enviado (PENDING).
  const canSendToKitchen = !isEdit || order?.status === "PENDING";

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-4 sm:px-8 py-8 w-full animate-pulse space-y-6">
        <div className="flex gap-4 mb-2">
          <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg shrink-0" />
          <div className="space-y-2 mt-1">
            <div className="h-5 w-48 bg-zinc-100 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-64 bg-zinc-100 dark:bg-zinc-800/50 rounded" />
          </div>
        </div>
        <div className="h-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl" />
          <div className="h-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      {showDeleteConfirm && (
        <ConfirmDialog
          title="¿Eliminar pedido?"
          message={
            <>
              <p>
                Se eliminará el pedido{" "}
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  #{order?.id} (Mesa {order?.tableNumber})
                </span>
                .
              </p>
              <p className="mt-1">Esta acción no se puede deshacer.</p>
            </>
          }
          confirmLabel="Eliminar pedido"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div className="px-4 sm:px-8 py-8 w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={goBack}
            className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            title="Volver"
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
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {isEdit ? `Pedido #${order?.id}` : "Nuevo pedido"}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {access?.waiterName
                ? `Camarero/a: ${access.waiterName}`
                : isEdit
                  ? "Edita los datos y los platos del pedido"
                  : "Toca la mesa y añade platos de la carta"}
            </p>
          </div>
          {order && (
            <span
              className={`ml-auto px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[order.status]}`}
            >
              {STATUS_LABEL[order.status]}
            </span>
          )}
        </div>

        {/* ── Datos del pedido (barra compacta) ── */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-4">
            <Field label="Nº de mesa" required error={fieldErrors.tableNumber}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                className={`${getInputClass(fieldErrors.tableNumber)} text-center text-2xl font-bold py-4`}
                placeholder="4"
                value={form.tableNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tableNumber: e.target.value }))
                }
              />
            </Field>
            <Field label="Notas" hint="(alergias, peticiones especiales…)">
              <input
                type="text"
                className={getInputClass()}
                placeholder="Ej. sin gluten en la mesa 4, cumpleaños…"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </Field>
          </div>
        </div>

        {/* ── Menú lateral de secciones + Carta + Pedido en curso ── */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Menú lateral de secciones (dinámico) */}
          {hasAnyDishes && (
            <div className="w-full lg:w-48 shrink-0 lg:sticky lg:top-6">
              <SectionTitle>Secciones</SectionTitle>
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible -mx-1 px-1 pb-1 lg:pb-0">
                <button
                  type="button"
                  onClick={() => setActiveCategory(ALL_CATEGORIES)}
                  className={`shrink-0 lg:w-full text-left px-4 py-3.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                    activeCategory === ALL_CATEGORIES
                      ? "bg-teal-600 text-white"
                      : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  Todos
                </button>
                {presentCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveCategory(c)}
                    className={`shrink-0 lg:w-full text-left px-4 py-3.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                      activeCategory === c
                        ? "bg-teal-600 text-white"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="hidden lg:block text-[11px] text-zinc-600 mt-3 px-1 leading-snug">
                Las secciones nuevas que crees en «Carta» al añadir un plato
                aparecen aquí automáticamente.
              </p>
            </div>
          )}

          {/* Carta: buscador + rejilla de platos */}
          <div className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
            <SectionTitle>Carta</SectionTitle>

            {hasAnyDishes ? (
              <>
                {/* Buscador */}
                <div className="relative mb-4">
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
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                    placeholder="Buscar en la carta..."
                    className={`${getInputClass()} pl-12`}
                  />
                </div>

                {/* Rejilla de platos — botones grandes, pensados para tablet */}
                {dishIndex.length === 0 ? (
                  <p className="text-sm text-zinc-600 py-10 text-center">
                    Ningún plato coincide con «{dishSearch}».
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {dishIndex.map((dish) => (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => handleAddDish(dish.name, dish.price)}
                        className="flex flex-col items-start gap-2 px-4 py-4 min-h-[5.5rem] bg-zinc-50 dark:bg-zinc-950/50 hover:bg-teal-50 dark:hover:bg-teal-500/10 active:bg-teal-500/20 border border-zinc-200 dark:border-zinc-800 hover:border-teal-400 dark:hover:border-teal-500/50 rounded-2xl text-left transition-colors"
                      >
                        <span className="text-base text-zinc-900 dark:text-zinc-100 font-semibold leading-snug line-clamp-2">
                          {dish.name}
                        </span>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
                          {dish.price ? `${dish.price} €` : "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-600 bg-zinc-50 dark:bg-zinc-950/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-6 text-center">
                Este restaurante todavía no tiene cartas con platos. Añade
                platos personalizados abajo.
              </p>
            )}

            {/* Plato personalizado (no está en la carta) */}
            <div className="mt-5 pt-5 border-t border-zinc-200 dark:border-zinc-800">
              {!customOpen ? (
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-teal-700 dark:hover:text-teal-400 bg-zinc-50 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl transition-colors"
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
                  Añadir plato personalizado
                </button>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Nombre del plato"
                      className={`${getInputClass()} col-span-2`}
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="Precio (€)"
                      className={getInputClass()}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
                      className={`${getInputClass()} w-20 text-center`}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustom}
                      className="px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      Añadir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomOpen(false);
                        setCustomName("");
                        setCustomPrice("");
                        setCustomQty("1");
                      }}
                      className="px-4 py-3 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pedido en curso: fijo al lado, siempre visible */}
          <div className="w-full lg:w-[26rem] shrink-0 lg:sticky lg:top-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 lg:max-h-[calc(100vh-3rem)]">
            <SectionTitle>Pedido en curso</SectionTitle>

            <div className="flex-1 overflow-y-auto -mr-1 pr-1 min-h-16">
              {form.items.length === 0 ? (
                <p className="text-sm text-zinc-600 bg-zinc-50 dark:bg-zinc-950/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-8 text-center">
                  Toca un plato de la carta para añadirlo.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.items.map((it) => {
                    const qty = Number(it.quantity) || 0;
                    const price = Number(it.unitPrice) || 0;
                    return (
                      <div
                        key={it.key}
                        className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5"
                      >
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) =>
                            updateItemQty(it.key, e.target.value)
                          }
                          className="w-16 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-sm text-zinc-800 dark:text-zinc-200 text-center focus:outline-none focus:border-teal-500"
                        />
                        <span className="text-zinc-500 text-xs">×</span>
                        <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate">
                          {it.dishName}
                        </span>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
                          {money(qty * price)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(it.key)}
                          className="p-2 text-zinc-600 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
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
                    );
                  })}
                </div>
              )}
              {fieldErrors.items && (
                <p className="mt-2 text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                  <svg
                    className="w-3 h-3 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                  {fieldErrors.items}
                </p>
              )}
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 flex items-center justify-between text-base font-semibold">
              <span className="text-zinc-700 dark:text-zinc-300">Total</span>
              <span className="text-zinc-900 dark:text-zinc-100 tabular-nums">
                {money(total)}
              </span>
            </div>

            {isEdit && order && (
              <p className="text-xs text-zinc-600">
                El estado de cocina (pendiente, en cocina, listo, entregado o
                cancelado) se gestiona desde el listado de pedidos.
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-3 py-2">
                <svg
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {canSendToKitchen && (
                <button
                  type="button"
                  onClick={() => void submit(true)}
                  disabled={!!saving}
                  className="flex items-center justify-center gap-2 px-5 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-base font-bold rounded-xl transition-colors"
                >
                  {saving === "send" && (
                    <svg
                      className="w-4 h-4 animate-spin"
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
                  )}
                  {saving === "send" ? "Enviando…" : "Enviar a cocina"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void submit(false)}
                disabled={!!saving}
                className="flex items-center justify-center gap-2 px-5 py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-base font-semibold rounded-xl transition-colors"
              >
                {saving === "save" && (
                  <svg
                    className="w-4 h-4 animate-spin"
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
                )}
                {saving === "save"
                  ? "Guardando…"
                  : isEdit
                    ? "Guardar cambios"
                    : "Guardar como nuevo (sin enviar)"}
              </button>
              <button
                type="button"
                onClick={goBack}
                className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-400/10 border border-red-200 dark:border-red-500/20 hover:border-red-300 dark:hover:border-red-500/40 text-sm font-medium rounded-xl transition-colors"
                >
                  <svg
                    className="w-4 h-4"
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
                  Eliminar pedido
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
