// customer-portal/src/hooks/useTheme.ts
import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

// Todas las instancias de useTheme() comparten este mismo store: sin esto,
// dos <ThemeToggle> montados a la vez (por ejemplo la barra superior móvil y
// el propio menú desplegable) tendrían cada uno su copia de estado y solo se
// actualizaría el icono de la instancia sobre la que se pulsó, dejando la
// otra desincronizada del tema real hasta recargar la página.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // localStorage puede no estar disponible (modo privado, etc.); el
    // tema simplemente no se recordará entre visitas.
  }
  notify();
}

/**
 * Tema claro/oscuro de toda la app: alterna la clase `dark` en `<html>` y
 * recuerda la elección en localStorage. Todas las instancias de este hook
 * leen y se suscriben al mismo estado (la clase del `<html>`), así que
 * cambiar el tema desde cualquier interruptor actualiza a la vez todos los
 * demás, estén montados o no en ese momento.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    applyTheme(getSnapshot() === "dark" ? "light" : "dark");
  }, []);

  return { theme, toggleTheme };
}
