import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 text-center px-6">
      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-3">
        Error 404
      </p>
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        Página no encontrada
      </h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-sm">
        La ruta que has solicitado no existe o ha sido eliminada.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />
        Volver al inicio
      </Link>
    </div>
  );
}
