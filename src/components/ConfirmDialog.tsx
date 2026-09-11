// customer-portal/src/components/ConfirmDialog.tsx
//
// Diálogo de confirmación compartido por toda la app (pedidos, reservas,
// carta...). Sustituye a los `window.confirm()`/`alert()` del navegador y a
// las variantes que antes se repetían copiadas en cada página, para que
// eliminar, cancelar o confirmar algo se vea y se comporte siempre igual.

export type ConfirmDialogTone = "danger" | "warning" | "default";

const CONFIRM_BUTTON_STYLES: Record<ConfirmDialogTone, string> = {
  danger:
    "bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20",
  warning:
    "bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20",
  default: "bg-teal-600 hover:bg-teal-500 text-white border border-transparent",
};

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

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" (rojo, por defecto) para eliminar/cancelar; "warning" (ámbar)
   *  para acciones a medio camino; "default" (teal) para confirmaciones
   *  positivas, p. ej. "Confirmar reserva". */
  tone?: ConfirmDialogTone;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl w-full max-w-sm p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          {title}
        </h3>
        <div className="text-sm text-zinc-500 mb-6 space-y-1">{message}</div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 ${CONFIRM_BUTTON_STYLES[tone]}`}
          >
            {loading && <Spinner />}
            {loading ? "Un momento…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
