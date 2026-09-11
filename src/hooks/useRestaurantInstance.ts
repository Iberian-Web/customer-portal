// customer-portal/src/hooks/useRestaurantInstance.ts
import { useAuth } from "../auth/useAuth";
import { slugify } from "../utils/slug";
import type { Instance } from "../api";

export type RestaurantInstance = Instance & { slug: string };

/**
 * Cada credencial de este portal pertenece a un único cliente, y hoy en día
 * un cliente solo puede contratar una vez la app "Restaurante" — así que en
 * vez de fiarnos de un id en la URL, resolvemos la instancia real a partir de
 * la sesión ya autenticada. El id numérico solo se usa para llamar a la API;
 * el "slug" (a partir del nombre de la empresa) es el que se ve en la URL.
 */
export function useRestaurantInstance(): RestaurantInstance | undefined {
  const { access } = useAuth();
  const instance = access?.instances.find(
    (i) => i.application.name === "Restaurante",
  );
  if (!instance || !access) return undefined;
  return { ...instance, slug: slugify(access.company || access.name) };
}
