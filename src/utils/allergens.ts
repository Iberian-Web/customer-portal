// customer-portal/src/utils/allergens.ts
// Mirrors the Allergen enum in schema.prisma (restaurant schema).
import type { Allergen } from "../api";

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  GLUTEN: "Gluten",
  CRUSTACEOS: "Crustáceos",
  HUEVOS: "Huevos",
  PESCADO: "Pescado",
  CACAHUETES: "Cacahuetes",
  SOJA: "Soja",
  LACTEOS: "Lácteos",
  FRUTOS_DE_CASCARA: "Frutos de cáscara",
  APIO: "Apio",
  MOSTAZA: "Mostaza",
  SESAMO: "Sésamo",
  SULFITOS: "Sulfitos",
  ALTRAMUCES: "Altramuces",
  MOLUSCOS: "Moluscos",
};

export const ALL_ALLERGENS = Object.keys(ALLERGEN_LABELS) as Allergen[];
