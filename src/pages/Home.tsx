import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-10 text-center">
      <div className="max-w-xl rounded-3xl border border-zinc-800 bg-zinc-900 p-10 shadow-[0_0_0_1px_rgba(148,163,184,0.08)]">
        <p className="text-sm font-semibold text-indigo-400 uppercase tracking-[0.3em] mb-3">
          Bienvenido al portal
        </p>
        <h1 className="text-3xl font-semibold text-zinc-100 mb-4">
          Selecciona un servicio desde la barra lateral
        </h1>
        <p className="text-sm leading-6 text-zinc-400 mb-8">
          Aquí verás tus aplicaciones activas y accederás a tus módulos disponibles.
          Si no ves nada todavía, revisa tu acceso o actualiza la página.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Actualizar
        </Link>
      </div>
    </div>
  );
}
