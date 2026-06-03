export const EVENT_CATEGORIES = [
  "animaux",
  "art",
  "associatif",
  "atelier",
  "automobile",
  "bien-etre",
  "business",
  "cinema",
  "concert",
  "conference",
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
  "marche",
  "mode",
  "musique",
  "nature",
  "networking",
  "nightlife",
  "patrimoine",
  "plein-air",
  "randonnee",
  "sante",
  "shopping",
  "solidarite",
  "soiree",
  "spectacle",
  "sport",
  "technologie",
  "theatre",
  "tourisme",
  "etudiant",
  "exposition",
] as const;

export type EventCategoryName = (typeof EVENT_CATEGORIES)[number];
export type EventCategory = EventCategoryName;

export type EventCategoryOption = {
  id: number;
  name: EventCategoryName;
  slug: string;
};

export type { Event } from "./event";
