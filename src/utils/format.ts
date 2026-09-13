// customer-portal/src/utils/format.ts

export function money(n: number): string {
  return `${n.toFixed(2)} €`;
}

export function toLocalTimeString(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
