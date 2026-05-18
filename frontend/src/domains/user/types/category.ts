/**
 * Ce fichier contient les types TypeScript liés aux catégories.
 * L'objectif est de centraliser les catégories disponibles dans
 * l'application afin d'assurer une structure cohérente.
 */

/** Liste des catégories disponibles */
export const CATEGORIES = [
  "culture",
  "musique",
  "art",
  "tourisme",
  "associatif",
  "famille",
  "sport",
  "festival",
  "concert",
  "cinema",
  "theatre",
  "gastronomie",
  "technologie",
  "gaming",
] as const;

/** Création du type CategoryName à partir du tableau */
export type CategoryName = (typeof CATEGORIES)[number];

/** Type représentant une catégorie */
export type Category = {
  id: number; /** Identifiant unique */
  name: CategoryName; /** Nom affiché */
  slug: string; /** Version URL-friendly */
};