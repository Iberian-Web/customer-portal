// customer-portal/src/utils/slug.ts

/**
 * Convierte un texto libre (p. ej. el nombre de una empresa) en un slug apto
 * para una URL: minúsculas, sin acentos ni símbolos, palabras unidas por "-".
 * "Chiringuito Carlos" -> "chiringuito-carlos"
 */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "restaurante";
}
