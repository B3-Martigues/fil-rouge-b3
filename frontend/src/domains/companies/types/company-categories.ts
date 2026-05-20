/**
 * Categories disponibles pour les entreprises.
 * Le tableau contient les valeurs manipulables dans les formulaires.
 */
export const COMPANY_CATEGORIES = [
  "art",
  "associatif",
  "bien-être",
  "business",
  "culture",
  "famille",
  "formation",
  "gaming",
  "gastronomie",
  "musique",
  "nature",
  "sport",
  "soirée",
  "technologie",
  "tourisme",
] as const;

/** Alias utilise par les formulaires historiques du domaine entreprise. */
export const CATEGORIES = COMPANY_CATEGORIES;

/** Nom technique d'une categorie d'entreprise. */
export type CompanyCategoryName = (typeof COMPANY_CATEGORIES)[number];
export type CategoryName = CompanyCategoryName;

/** Valeur simple utilisee pour selectionner ou filtrer une categorie. */
export type CompanyCategory = CompanyCategoryName;

/** Objet categorie stocke sur une entreprise. */
export type CompanyCategoryOption = {
  id: number; /** Identifiant unique. */
  name: CompanyCategoryName; /** Nom de categorie. */
  slug: string; /** Version URL-friendly. */
};

export type CategoryOption = CompanyCategoryOption;
