// customer-portal/src/hooks/useInstanceEvents.ts
import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { subscribeToInstanceEvents } from "../api";

/**
 * Se conecta al stream de notificaciones en tiempo real (SSE) de una
 * instancia e invalida las queries indicadas cada vez que llega un aviso,
 * en vez de depender solo de un `refetchInterval` sondeando cada pocos
 * segundos. Las páginas que lo usan mantienen igualmente un polling de
 * fondo (mucho más espaciado) como red de seguridad por si el stream se
 * corta y el navegador tarda en reconectar.
 */
export function useInstanceEvents(
  instanceId: number | undefined,
  queryKeys: QueryKey[],
) {
  const queryClient = useQueryClient();
  // Evita que un array literal nuevo en cada render reabra la conexión: se
  // actualiza en un efecto (no durante el render) para que la suscripción
  // de más abajo siempre lea, en la próxima notificación, el conjunto de
  // queries más reciente sin tener que volver a conectar el stream.
  const keysRef = useRef(queryKeys);
  useEffect(() => {
    keysRef.current = queryKeys;
  });

  useEffect(() => {
    if (!instanceId) return;
    const unsubscribe = subscribeToInstanceEvents(instanceId, () => {
      for (const key of keysRef.current) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    });
    return unsubscribe;
  }, [instanceId, queryClient]);
}
