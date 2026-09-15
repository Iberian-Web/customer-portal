// customer-portal/src/pages/restaurant/DishForm.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  menusApi,
  dishesApi,
  menuSectionsApi,
  type Dish,
  type Allergen,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
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
import { ALLERGEN_LABELS, ALL_ALLERGENS } from "../../utils/allergens";

// ─── Form state ───────────────────────────────────────────────────────────────

type DishFields = {
  name: string;
  description: string;
  price: string;
  category: string;
  allergens: Allergen[];
};

const EMPTY_DISH: DishFields = {
  name: "",
  description: "",
  price: "",
  category: "",
  allergens: [],
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function DishForm() {
  const { dishId } = useParams<{ dishId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const instance = useRestaurantInstance();
  const instId = instance?.id ?? 0;
  const slug = instance?.slug ?? "";
  const isEdit = !!dishId && dishId !== "new";
  const menuIdParam = searchParams.get("menuId");

  const [dish, setDish] = useState<Dish | null>(null);
  const [targetMenuId, setTargetMenuId] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [form, setForm] = useState<DishFields>(EMPTY_DISH);
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const queryClient = useQueryClient();

  const goBack = useCallback(
    (menuId?: number | null) => {
      const target = menuId ?? targetMenuId;
      navigate(`/restaurant/${slug}/menu${target ? `?menuId=${target}` : ""}`);
    },
    [navigate, slug, targetMenuId],
  );

  // ── Load (no hay endpoint de detalle de plato: se busca en las cartas) ──
  const {
    data: menus,
    isLoading: menusLoading,
    error: menusQueryError,
  } = useQuery({
    queryKey: ["menus", instId],
    queryFn: () => menusApi.list(instId),
    enabled: !!instId,
  });
  const { data: sectionsData, isLoading: sectionsLoading } = useQuery({
    queryKey: ["menuSections", instId],
    queryFn: () => menuSectionsApi.list(instId),
    enabled: !!instId,
  });
  const sections = sectionsData ?? [];
  const loading = menusLoading || sectionsLoading;
  const loadError = menusQueryError
    ? getErrorMessage(menusQueryError, "Error al cargar el plato")
    : null;

  // Se calcula una sola vez, cuando ambas listas ya han llegado: localiza el
  // plato a editar, o la carta destino si es uno nuevo.
  const targetDish = useMemo(() => {
    if (!isEdit || !menus) return undefined;
    return menus.flatMap((m) => m.dishes).find((d) => d.id === Number(dishId));
  }, [isEdit, menus, dishId]);
  const targetMenu = useMemo(() => {
    if (isEdit || !menus) return undefined;
    return menus.find((m) => m.id === Number(menuIdParam)) ?? menus[0];
  }, [isEdit, menus, menuIdParam]);

  // Si no hay plato/carta destino una vez cargados los datos, es que la URL
  // ya no es válida (p. ej. el plato se borró) — es un efecto secundario
  // real (navegación), así que sí va en un efecto.
  useEffect(() => {
    if (initialized || !menus || sectionsData === undefined) return;
    const notFound = isEdit ? !targetDish : !targetMenu;
    if (notFound) navigate(`/restaurant/${slug}/menu`, { replace: true });
  }, [
    initialized,
    menus,
    sectionsData,
    isEdit,
    targetDish,
    targetMenu,
    navigate,
    slug,
  ]);

  // Siembra el formulario una sola vez. Va en el cuerpo del render (no en un
  // efecto): es una adaptación de estado a partir de datos ya cargados, no
  // una sincronización con un sistema externo.
  if (!initialized && menus && sectionsData !== undefined) {
    if (isEdit && targetDish) {
      setInitialized(true);
      setDish(targetDish);
      setTargetMenuId(targetDish.menuId);
      setForm({
        name: targetDish.name,
        description: targetDish.description,
        price: targetDish.price,
        category: targetDish.category,
        allergens: targetDish.allergens ?? [],
      });
    } else if (!isEdit && targetMenu) {
      setInitialized(true);
      setTargetMenuId(targetMenu.id);
      setForm({ ...EMPTY_DISH, category: sectionsData[0]?.name ?? "" });
    }
  }

  const setField = <K extends keyof DishFields>(k: K, v: DishFields[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleAllergen = (a: Allergen) => {
    setForm((f) => ({
      ...f,
      allergens: f.allergens.includes(a)
        ? f.allergens.filter((x) => x !== a)
        : [...f.allergens, a],
    }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: form.price.trim(),
        category: form.category,
        allergens: form.allergens,
      };
      if (isEdit && dish) {
        await dishesApi.update(dish.id, payload);
        return dish.menuId;
      } else if (targetMenuId) {
        await dishesApi.create(targetMenuId, payload);
        return targetMenuId;
      }
      return null;
    },
    onSuccess: (menuId) => {
      void queryClient.invalidateQueries({ queryKey: ["menus", instId] });
      goBack(menuId);
    },
    onError: (submitError: unknown) =>
      setError(getErrorMessage(submitError, "Error al guardar el plato")),
  });

  const submit = () => {
    if (!form.name.trim()) {
      setNameError("El nombre es obligatorio.");
      return;
    }
    setNameError("");
    setError(null);
    submitMutation.mutate();
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => dishesApi.remove(dish!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["menus", instId] });
      goBack(dish?.menuId);
    },
    onError: (deleteError: unknown) => {
      setError(getErrorMessage(deleteError, "Error al eliminar el plato"));
      setShowDeleteConfirm(false);
    },
  });

  const handleDelete = () => {
    if (dish) deleteMutation.mutate();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <FormPageSkeleton />;

  const displayError = error ?? loadError;

  return (
    <>
      {showDeleteConfirm && (
        <ConfirmDialog
          title="¿Eliminar plato?"
          message={
            <>
              Se eliminará{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                {dish?.name}
              </span>
              . Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Eliminar"
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div className="px-4 sm:px-8 py-8 w-full max-w-3xl mx-auto">
        <FormPageHeader
          onBack={() => goBack()}
          title={isEdit ? "Editar plato" : "Nuevo plato"}
          subtitle={
            isEdit
              ? "Modifica los datos del plato"
              : "Añade un plato a la carta"
          }
        />

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <SectionTitle>Datos del plato</SectionTitle>
            <div className="space-y-4">
              <Field label="Nombre" required error={nameError}>
                <input
                  className={getInputClass(nameError)}
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ej. Croquetas de jamón"
                />
              </Field>

              <Field label="Descripción">
                <input
                  className={getInputClass()}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Descripción breve"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Precio (€)">
                  <input
                    className={getInputClass()}
                    value={form.price}
                    onChange={(e) => setField("price", e.target.value)}
                    placeholder="9.50"
                  />
                </Field>
                <Field
                  label="Sección de la carta"
                  hint={
                    sections.length === 0
                      ? undefined
                      : "· gestiónalas en la carta"
                  }
                >
                  <select
                    className={getInputClass()}
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                  >
                    <option value="">Sin sección</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                    {/* Si el plato tenía una sección ya eliminada de la lista
                        gestionada, se mantiene visible para no perderla en
                        silencio al abrir el formulario. */}
                    {form.category &&
                      !sections.some((s) => s.name === form.category) && (
                        <option value={form.category}>
                          {form.category} (eliminada)
                        </option>
                      )}
                  </select>
                </Field>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <SectionTitle>Alérgenos</SectionTitle>
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

          {displayError && <FormErrorBanner message={displayError} />}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-400/10 border border-red-200 dark:border-red-500/20 hover:border-red-300 dark:hover:border-red-500/40 text-sm font-medium rounded-xl transition-colors"
              >
                <Icon name="trash" strokeWidth={1.8} />
                Eliminar plato
              </button>
            )}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:ml-auto">
              <button
                type="button"
                onClick={submit}
                disabled={submitMutation.isPending}
                className="flex items-center justify-center gap-2 px-5 py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-base font-semibold rounded-xl transition-colors"
              >
                {submitMutation.isPending && <Spinner />}
                {submitMutation.isPending
                  ? "Guardando…"
                  : isEdit
                    ? "Guardar cambios"
                    : "Crear plato"}
              </button>
              <button
                type="button"
                onClick={() => goBack()}
                className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
