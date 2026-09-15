// customer-portal/src/components/ThemeToggle.tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

/**
 * Pequeño interruptor sol/luna para cambiar entre tema claro y oscuro.
 * Sol = estamos en modo claro, pulsar pasa a oscuro (y viceversa).
 */
export default function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`relative w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${className}`}
    >
      {isDark ? (
        <Moon className="w-4.5 h-4.5" strokeWidth={1.8} />
      ) : (
        <Sun className="w-4.5 h-4.5" strokeWidth={1.8} />
      )}
    </button>
  );
}
