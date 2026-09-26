// Piezas compartidas por las páginas de formulario a tamaño completo
// (pedidos, reservas, platos), para que se vean y comporten igual.
import type { ReactNode } from "react";
import { Icon } from "./icons";

export function FormPageHeader({
  onBack,
  title,
  subtitle,
  right,
}: {
  onBack: () => void;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={onBack}
        className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        title="Volver"
        aria-label="Volver"
      >
        <Icon name="arrowLeft" className="w-5 h-5" />
      </button>
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
      {children}
    </h2>
  );
}

export function Field({
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
  children: ReactNode;
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
          <Icon name="warningCircle" className="w-3 h-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export function FormErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-lg px-3 py-2">
      <Icon name="warningTriangle" className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      {message}
    </div>
  );
}

export function FormPageSkeleton() {
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
      <div className="h-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl" />
    </div>
  );
}
