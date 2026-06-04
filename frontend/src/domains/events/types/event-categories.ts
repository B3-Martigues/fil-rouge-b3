export const EVENT_CATEGORY_OPTIONS = [
  { id: 1, name: "animaux", slug: "animaux" },
  { id: 2, name: "art", slug: "art" },
  { id: 3, name: "associatif", slug: "associatif" },
  { id: 4, name: "atelier", slug: "atelier" },
  { id: 5, name: "automobile", slug: "automobile" },
  { id: 6, name: "bien-etre", slug: "bien-etre" },
  { id: 7, name: "business", slug: "business" },
  { id: 8, name: "cinema", slug: "cinema" },
  { id: 9, name: "concert", slug: "concert" },
  { id: 10, name: "conference", slug: "conference" },
  { id: 11, name: "culture", slug: "culture" },
  { id: 12, name: "emploi", slug: "emploi" },
  { id: 13, name: "enfants", slug: "enfants" },
  { id: 14, name: "esport", slug: "esport" },
  { id: 15, name: "famille", slug: "famille" },
  { id: 16, name: "festival", slug: "festival" },
  { id: 17, name: "food", slug: "food" },
  { id: 18, name: "formation", slug: "formation" },
  { id: 19, name: "gaming", slug: "gaming" },
  { id: 20, name: "gastronomie", slug: "gastronomie" },
  { id: 21, name: "humour", slug: "humour" },
  { id: 22, name: "jeux", slug: "jeux" },
  { id: 23, name: "marche", slug: "marche" },
  { id: 24, name: "mode", slug: "mode" },
  { id: 25, name: "musique", slug: "musique" },
  { id: 26, name: "nature", slug: "nature" },
  { id: 27, name: "networking", slug: "networking" },
  { id: 28, name: "nightlife", slug: "nightlife" },
  { id: 29, name: "patrimoine", slug: "patrimoine" },
  { id: 30, name: "plein-air", slug: "plein-air" },
  { id: 31, name: "randonnee", slug: "randonnee" },
  { id: 32, name: "sante", slug: "sante" },
  { id: 33, name: "shopping", slug: "shopping" },
  { id: 34, name: "solidarite", slug: "solidarite" },
  { id: 35, name: "soiree", slug: "soiree" },
  { id: 36, name: "spectacle", slug: "spectacle" },
  { id: 37, name: "sport", slug: "sport" },
  { id: 38, name: "technologie", slug: "technologie" },
  { id: 39, name: "theatre", slug: "theatre" },
  { id: 40, name: "tourisme", slug: "tourisme" },
  { id: 41, name: "etudiant", slug: "etudiant" },
  { id: 42, name: "exposition", slug: "exposition" },
] as const;

export type EventCategoryOption = (typeof EVENT_CATEGORY_OPTIONS)[number];
export type EventCategoryName = EventCategoryOption["slug"];
export type EventCategory = EventCategoryName;

export const EVENT_CATEGORIES = EVENT_CATEGORY_OPTIONS.map(
  (category) => category.slug,
);

export const getEventCategoryById = (id: number) =>
  EVENT_CATEGORY_OPTIONS.find((category) => category.id === id);

export const getEventCategoryBySlug = (slug: EventCategoryName) =>
  EVENT_CATEGORY_OPTIONS.find((category) => category.slug === slug);

export const getEventCategoryId = (slug: EventCategoryName) => {
  const category = getEventCategoryBySlug(slug);

  if (!category) {
    throw new Error(`Unknown event category slug: ${slug}`);
  }

  return category.id;
};

export const getEventCategorySlug = (id: number) =>
  getEventCategoryById(id)?.slug;

export type { Event } from "./event";
