// customer-portal/src/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // El portal ya tiene su propio sondeo explícito donde hace falta
      // (p. ej. Cocina con refetchInterval); no lo dupliques con refetch
      // agresivo al recuperar el foco de la pestaña.
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});
