// customer-portal/src/pages/restaurant/ReservationForm.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  reservationsApi,
  type Reservation,
  type ReservationCreate,
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

// ─── Form state ───────────────────────────────────────────────────────────────

type FormFields = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  date: string;
  time: string;
  guests: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormFields, string>>;

const EMPTY_FORM: FormFields = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  date: "",
  time: "",
  guests: "",
  notes: "",
};

function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function isoToDateInput(iso: string): string {
  return iso.split("T")[0];
}

function isoToTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReservationForm() {
  const { reservationId } = useParams<{ reservationId?: string }>();
  const navigate = useNavigate();
  const instance = useRestaurantInstance();
  const id = instance?.id ?? 0;
  const slug = instance?.slug ?? "";
  const isEdit = !!reservationId && reservationId !== "new";
  const goBack = () => navigate(`/restaurant/${slug}/reservations`);

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const queryClient = useQueryClient();

  // ── Load (no hay endpoint de detalle: se busca en el listado) ──
  const {
    data: reservationsList,
    isLoading: listLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["reservations", id],
    queryFn: () => reservationsApi.list(id),
    enabled: isEdit && !!id,
  });
  const loading = isEdit ? listLoading || !initialized : false;
  const loadError = queryError
    ? getErrorMessage(queryError, "Error al cargar la reserva")
    : null;

  // Localiza la reserva a editar (una sola vez, cuando llega el listado).
  const found = useMemo(() => {
    if (!isEdit || !reservationsList) return undefined;
    return reservationsList.find((r) => r.id === Number(reservationId));
  }, [isEdit, reservationsList, reservationId]);

  // Si no existe, es que la URL ya no es válida — efecto secundario real
  // (navegación), así que sí va en un efecto.
  useEffect(() => {
    if (!isEdit || initialized || !reservationsList) return;
    if (!found) navigate(`/restaurant/${slug}/reservations`, { replace: true });
  }, [isEdit, initialized, reservationsList, found, navigate, slug]);

  // Siembra el formulario una sola vez. Va en el cuerpo del render (no en
  // un efecto): es una adaptación de estado a partir de datos ya cargados,
  // no una sincronización con un sistema externo.
  if (isEdit && !initialized && reservationsList && found) {
    setInitialized(true);
    setReservation(found);
    setForm({
      customerName: found.customerName,
      customerPhone: found.customerPhone,
      customerEmail: found.customerEmail,
      date: isoToDateInput(found.reservationDate),
      time: isoToTimeInput(found.reservationDate),
      guests: String(found.guests),
      notes: found.notes,
    });
  }

  const setField = (key: keyof FormFields, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  // ── Validation + submit ──────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.customerName.trim())
      errs.customerName = "Introduce el nombre del cliente.";
    if (!form.customerPhone.trim())
      errs.customerPhone = "Introduce un teléfono de contacto.";
    if (!form.date) errs.date = "Selecciona una fecha.";
    if (!form.time) errs.time = "Selecciona una hora.";
    const guests = Number(form.guests);
    if (!guests || guests <= 0)
      errs.guests = "Introduce el número de comensales.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitMutation = useMutation({
    mutationFn: (payload: ReservationCreate) =>
      isEdit && reservation
        ? reservationsApi.update(reservation.id, payload)
        : reservationsApi.create(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations", id] });
      goBack();
    },
    onError: (submitError: unknown) =>
      setError(getErrorMessage(submitError, "Error al guardar la reserva")),
  });

  const submit = () => {
    if (!validate()) return;
    setError(null);

    const payload: ReservationCreate = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      customerEmail: form.customerEmail.trim() || undefined,
      reservationDate: toIso(form.date, form.time),
      guests: Number(form.guests),
      notes: form.notes.trim() || undefined,
    };
    submitMutation.mutate(payload);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => reservationsApi.remove(reservation!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reservations", id] });
      goBack();
    },
    onError: (deleteError: unknown) => {
      setError(getErrorMessage(deleteError, "Error al eliminar la reserva"));
      setShowDeleteConfirm(false);
    },
  });

  const handleDelete = () => {
    if (reservation) deleteMutation.mutate();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <FormPageSkeleton />;

  const displayError = error ?? loadError;

  return (
    <>
      {showDeleteConfirm && (
        <ConfirmDialog
          title="¿Eliminar reserva?"
          message={
            <>
              <p>
                Se eliminará la reserva de{" "}
                <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                  {reservation?.customerName}
                </span>
                .
              </p>
              <p className="mt-1">Esta acción no se puede deshacer.</p>
            </>
          }
          confirmLabel="Eliminar reserva"
          loading={deleteMutation.isPending}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      <div className="px-4 sm:px-8 py-8 w-full max-w-3xl mx-auto">
        <FormPageHeader
          onBack={goBack}
          title={isEdit ? "Editar reserva" : "Nueva reserva"}
          subtitle={
            isEdit
              ? "Modifica los datos de la reserva"
              : "Introduce los datos de la reserva"
          }
        />

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <SectionTitle>Datos del cliente</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Nombre completo"
                required
                error={fieldErrors.customerName}
              >
                <input
                  type="text"
                  className={getInputClass(fieldErrors.customerName)}
                  placeholder="John Smith"
                  value={form.customerName}
                  onChange={(e) => setField("customerName", e.target.value)}
                />
              </Field>
              <Field
                label="Teléfono"
                required
                error={fieldErrors.customerPhone}
              >
                <input
                  type="tel"
                  className={getInputClass(fieldErrors.customerPhone)}
                  placeholder="+34 666 111 222"
                  value={form.customerPhone}
                  onChange={(e) => setField("customerPhone", e.target.value)}
                />
              </Field>
              <Field label="Email" hint="(opcional)" className="sm:col-span-2">
                <input
                  type="email"
                  className={getInputClass()}
                  placeholder="john@example.com"
                  value={form.customerEmail}
                  onChange={(e) => setField("customerEmail", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="pt-1">
            <SectionTitle>Reserva</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Fecha" required error={fieldErrors.date}>
                <input
                  type="date"
                  className={getInputClass(fieldErrors.date)}
                  value={form.date}
                  onChange={(e) => setField("date", e.target.value)}
                />
              </Field>
              <Field label="Hora" required error={fieldErrors.time}>
                <input
                  type="time"
                  className={getInputClass(fieldErrors.time)}
                  value={form.time}
                  onChange={(e) => setField("time", e.target.value)}
                />
              </Field>
              <Field label="Comensales" required error={fieldErrors.guests}>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className={getInputClass(fieldErrors.guests)}
                  placeholder="2"
                  value={form.guests}
                  onChange={(e) => setField("guests", e.target.value)}
                />
              </Field>
              <Field label="Notas" hint="(opcional)" className="sm:col-span-3">
                <textarea
                  rows={3}
                  className={`${getInputClass()} resize-none`}
                  placeholder="Outdoor seating preferred…"
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </Field>
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
                Eliminar reserva
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
                    : "Crear reserva"}
              </button>
              <button
                type="button"
                onClick={goBack}
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
