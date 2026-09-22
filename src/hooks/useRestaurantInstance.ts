// customer-portal/src/hooks/useRestaurantInstance.ts
import { useAuth } from "../auth/useAuth";
import { slugify } from "../utils/slug";
import type { Instance } from "../api";

type RestaurantInstance = Instance & { slug: string };

/**
 * Resuelve la instancia real del restaurante a partir de la sesión
 * autenticada (una credencial = un cliente, y hoy solo cabe una instancia
 * de "Restaurante" por cliente), en vez de fiarse de un id en la URL.
 */
export function useRestaurantInstance(): RestaurantInstance | undefined {
  const { access } = useAuth();
  const instance = access?.instances.find(
    (i) => i.application.name === "Restaurante",
  );
  if (!instance || !access) return undefined;
  return { ...instance, slug: slugify(access.company || access.name) };
}
