/**
 * Categories disponibles pour les evenements.
 * Le tableau contient les valeurs manipulables dans les formulaires et filtres.
 */
export const EVENT_CATEGORIES = [
  "animaux",
  "art",
  "associatif",
  "atelier",
  "automobile",
  "bien-être",
  "business",
  "cinéma",
  "concert",
  "conférence",
  "culture",
  "emploi",
  "enfants",
  "esport",
  "famille",
  "festival",
  "food",
  "formation",
  "gaming",
  "gastronomie",
  "humour",
  "jeux",
  "marché",
  "mode",
  "musique",
  "nature",
  "networking",
  "nightlife",
  "patrimoine",
  "plein-air",
  "randonnée",
  "santé",
  "shopping",
  "solidarité",
  "soirée",
  "spectacle",
  "sport",
  "technologie",
  "théâtre",
  "tourisme",
  "étudiant",
  "exposition",
] as const;

/** Nom technique d'une categorie d'evenement. */
export type EventCategoryName = (typeof EVENT_CATEGORIES)[number];

/** Valeur simple utilisee pour selectionner ou filtrer une categorie. */
export type EventCategory = EventCategoryName;

/** Objet categorie disponible si l'API renvoie id/name/slug. */
export type EventCategoryOption = {
  id: number; /** Identifiant unique. */
  name: EventCategoryName; /** Nom de categorie. */
  slug: string; /** Version URL-friendly. */
};

/** Compatibilite avec les imports existants. */
export type { Event } from "./event";