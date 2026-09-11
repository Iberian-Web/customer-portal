import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 text-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
        <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mb-3">
          Bienvenido/a
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Selecciona un servicio
        </h1>
        <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
          Elige una opción desde la barra lateral para acceder a tus módulos
          disponibles.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-medium rounded-lg transition-colors border border-zinc-300 dark:border-zinc-700"
        >
          Actualizar
        </Link>
      </div>
    </div>
  );
}
