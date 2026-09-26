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

export function toLocalDateTimeString(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
