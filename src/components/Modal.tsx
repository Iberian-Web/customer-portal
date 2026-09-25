// Shell compartido (overlay + backdrop + tarjeta) para diálogos modales que
// no son una simple confirmación (ver ConfirmDialog para eso). Clic fuera
// cierra el modal; clic dentro no se propaga.
import type { MouseEvent, ReactNode } from "react";

export default function Modal({
  onClose,
  children,
  maxWidth = "max-w-sm",
}: {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl w-full ${maxWidth} p-6 shadow-lg max-h-[85vh] overflow-y-auto`}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
