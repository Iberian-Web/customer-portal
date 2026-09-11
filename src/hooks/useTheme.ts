// customer-portal/src/hooks/useTheme.ts
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  // index.html ya aplicó la clase "dark" antes de montar React (evita el
  // parpadeo); aquí solo leemos ese mismo resultado para que el estado de
  // React arranque en sincronía con el DOM.
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  }
  return "light";
}

/**
 * Tema claro/oscuro de toda la app. Cambiarlo alterna la clase `dark` en
 * `<html>` (de la que depende cada utilidad `dark:*` de Tailwind, ver
 * tailwind.config.mjs) y recuerda la elección en localStorage para la
 * próxima visita.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // localStorage puede no estar disponible (modo privado, etc.); el
      // tema simplemente no se recordará entre visitas.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
