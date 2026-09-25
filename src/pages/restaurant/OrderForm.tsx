// customer-portal/src/pages/restaurant/OrderForm.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ordersApi,
  menusApi,
  type Order,
  type OrderCreate,
  type Menu,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import { useAuth } from "../../auth/useAuth";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Icon, Spinner } from "../../components/icons";
import {
  FormPageHeader,
  SectionTitle,
  Field,
  FormErrorBanner,
  FormPageSkeleton,
} from "../../components/FormPage";
import { getInputClass } from "../../utils/inputClass";
import { getErrorMessage } from "../../utils/errors";
import { money } from "../../utils/format";
import { STATUS_LABEL, STATUS_STYLES } from "../../utils/orderStatus";

// ─── Config ───────────────────────────────────────────────────────────────────

// Sentinel para "todas las categorías" en el filtro de la carta.
const ALL_CATEGORIES = "__TODOS__";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let itemKeySeq = 0;
function newItemKey() {
  itemKeySeq += 1;
  return `item-${itemKeySeq}-${Date.now()}`;
}

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const instance = useRestaurantInstance();
  const { access } = useAuth();
  const id = instance?.id ?? 0;
  const slug = instance?.slug ?? "";
  const isEdit = !!orderId && orderId !== "new";
  // Si se llegó aquí desde el Mapa (nuevo pedido o editar uno existente
  // desde la modal de una mesa), al terminar hay que volver al Mapa en vez
  // de al listado de pedidos de siempre.
  const returnTo =
    searchParams.get("from") === "map"
      ? `/restaurant/${slug}/map`
      : `/restaurant/${slug}/orders`;
  const goBack = () => navigate(returnTo);

  // ── Data state ──
  const [order, setOrder] = useState<Order | null>(null);
  const [initialized, setInitialized] = useState(false);

  // ── Form state ──
  // "Nuevo pedido para esta mesa" precarga la mesa vía ?table=, para abrir un
  // pedido nuevo e independiente sin reabrir la comanda ya cerrada.
  const prefilledTable = !isEdit ? searchParams.get("table") : null;
  const [form, setForm] = useState<FormData>(
    prefilledTable ? { ...emptyForm, tableNumber: prefilledTable } : emptyForm,
  );
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [savingKind, setSavingKind] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Delete state ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Dish picker state ──
  const [dishSearch, setDishSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");

  const queryClient = useQueryClient();

  // ─ Load data ─
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ["menus", id],
    queryFn: () => menusApi.list(id).catch(() => [] as Menu[]),
    enabled: !!id,
  });

  const {
    data: existingOrder,
    isLoading: orderLoading,
    error: orderQueryError,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.get(Number(orderId)),
    enabled: isEdit,
    retry: false,
  });

  const loading = menusLoading || (isEdit && (orderLoading || !initialized));

  const isNotFoundError = (err: unknown) =>
    err instanceof Error &&
    "status" in err &&
    (err as { status?: number }).status === 404;

  // Si el pedido no existe (404), volvemos al listado — es un efecto
  // secundario real (navegación), así que va en un efecto. Cualquier otro
  // fallo se deriva directamente más abajo, sin pasar por estado.
  useEffect(() => {
    if (isEdit && orderQueryError && isNotFoundError(orderQueryError)) {
      navigate(returnTo, { replace: true });
    }
  }, [isEdit, orderQueryError, navigate, returnTo]);

  const loadError =
    isEdit && orderQueryError && !isNotFoundError(orderQueryError)
      ? getErrorMessage(orderQueryError, "Error al cargar el pedido")
      : null;

  // Siembra el formulario una sola vez, cuando llega el pedido a editar. Va
  // en el cuerpo del render (no en un efecto): es una adaptación de estado
  // a partir de datos ya cargados, no una sincronización con algo externo.
  if (isEdit && !initialized && existingOrder) {
    setInitialized(true);
    setOrder(existingOrder);
    setForm({
      tableNumber: String(existingOrder.tableNumber),
      notes: existingOrder.notes,
      items: existingOrder.items.map((it) => ({
        key: newItemKey(),
        dishName: it.dishName,
        quantity: String(it.quantity),
        unitPrice: String(it.unitPrice),
      })),
    });
  }

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

  // Secciones de carta realmente en uso: no hay lista fija, se calculan a
  // partir de los platos existentes.
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
   * Guarda el pedido. Uno nuevo entra siempre directo a cocina (IN_PROGRESS).
   * Editar uno existente solo actualiza sus datos/platos. El camarero/a
   * nunca se envía desde aquí: lo asocia el backend por la sesión.
   */
  const submitMutation = useMutation({
    mutationFn: async (payload: OrderCreate) => {
      if (isEdit) {
        await ordersApi.update(Number(orderId), payload);
      } else {
        await ordersApi.create(id, payload);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders", id] });
      if (isEdit) {
        void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      }
      goBack();
    },
    onError: (submitError: unknown) =>
      setError(getErrorMessage(submitError, "Error al guardar el pedido")),
    onSettled: () => setSavingKind(null),
  });

  const submit = () => {
    if (!validate()) return;

    const payload: OrderCreate = {
      tableNumber: Number(form.tableNumber),
      notes: form.notes.trim() || undefined,
      items: form.items.map((it) => ({
        dishName: it.dishName,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      })),
    };

    setSavingKind(!isEdit ? "send" : "save");
    setError(null);
    submitMutation.mutate(payload);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => ordersApi.remove(order!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders", id] });
      goBack();
    },
    onError: (deleteError: unknown) => {
      setError(getErrorMessage(deleteError, "Error al eliminar el pedido"));
      setShowDeleteConfirm(false);
    },
  });

  const handleDelete = () => {
    if (order) deleteMutation.mutate();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <FormPageSkeleton />;
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
          confirmLabel="Eliminar"
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div className="px-4 sm:px-8 py-8 w-full">
        <FormPageHeader
          onBack={goBack}
          title={
            isEdit
              ? `Pedido #${order?.id}`
              : prefilledTable
                ? `Nuevo pedido — Mesa ${prefilledTable}`
                : "Nuevo pedido"
          }
          subtitle={
            access?.waiterName
              ? `Camarero/a: ${access.waiterName}`
              : isEdit
                ? "Edita los datos y los platos del pedido"
                : prefilledTable
                  ? "Pedido nuevo e independiente para esta mesa: no afecta a la comanda anterior."
                  : "Toca la mesa y añade platos de la carta"
          }
          right={
            order && (
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[order.status]}`}
              >
                {STATUS_LABEL[order.status]}
              </span>
            )
          }
        />

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
                  <Icon
                    name="search"
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500"
                  />
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
                    {dishIndex.map((dish) => (
                      <button
                        key={dish.id}
                        type="button"
                        onClick={() => handleAddDish(dish.name, dish.price)}
                        className="flex flex-col items-start gap-2 px-4 py-4 min-h-22 min-w-0 bg-zinc-50 dark:bg-zinc-950/50 hover:bg-teal-50 dark:hover:bg-teal-500/10 active:bg-teal-500/20 border border-zinc-200 dark:border-zinc-800 hover:border-teal-400 dark:hover:border-teal-500/50 rounded-2xl text-left transition-colors"
                      >
                        <span className="w-full text-base text-zinc-900 dark:text-zinc-100 font-semibold leading-snug line-clamp-2 wrap-break-word">
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
                  <Icon name="plus" />
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
          <div className="w-full lg:w-104 shrink-0 lg:sticky lg:top-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 lg:max-h-[calc(100vh-3rem)]">
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
                          <Icon name="close" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {fieldErrors.items && (
                <p className="mt-2 text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                  <Icon name="warningCircle" className="w-3 h-3 shrink-0" />
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

            {(error ?? loadError) && (
              <FormErrorBanner message={error ?? loadError!} />
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={submit}
                disabled={!!savingKind}
                className={`flex items-center justify-center gap-2 px-5 py-4 disabled:opacity-50 text-white text-base font-bold rounded-xl transition-colors ${
                  !isEdit
                    ? "bg-blue-600 hover:bg-blue-500"
                    : "bg-teal-600 hover:bg-teal-500"
                }`}
              >
                {savingKind && <Spinner />}
                {savingKind
                  ? !isEdit
                    ? "Enviando…"
                    : "Guardando…"
                  : !isEdit
                    ? "Enviar a cocina"
                    : "Guardar"}
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
                  <Icon name="trash" strokeWidth={1.8} />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
