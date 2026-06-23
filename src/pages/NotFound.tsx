import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-center px-6">
      <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">
        Error 404
      </p>
      <h1 className="text-3xl font-semibold text-zinc-100 mb-2">Página no encontrada</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-sm">
        La ruta que has solicitado no existe o ha sido eliminada.
      </p>
      <Link
        to="/"
        className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors border border-zinc-700"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Volver al inicio
      </Link>
    </div>
  );
}
