import type { EventCategory } from "./event-categories";

/**
 * Structure des donnees liees aux evenements.
 * Les categories sont stockees sous forme de noms, comme les filtres et formulaires.
 */

/** Type principal representant un evenement. */
export type Event = {
  id: number; /** Identifiant unique de l'evenement. */
  company_id?: number | null; /** Identifiant de l'entreprise ayant cree l'evenement. */
  title: string; /** Titre de l'evenement. */
  description: string; /** Description de l'evenement. */
  date: string; /** Date et heure de l'evenement. */
  latitude: number; /** Latitude du lieu. */
  longitude: number; /** Longitude du lieu. */
  address?: string; /** Adresse de l'evenement. */
  city?: string; /** Ville de l'evenement. */
  postal_code?: number; /** Code postal de l'evenement. */
  category: EventCategory; /** Categorie principale de l'evenement. */
  categories?: EventCategory[]; /** Categories associees a l'evenement. */
  image?: string; /** Image de l'evenement. */
  source?: string; /** Source de l'evenement (API, scraping, manuel, etc.). */
  is_approved?: boolean; /** Statut de validation par un administrateur. */
  created_at?: string; /** Date de creation. */
  updated_at?: string; /** Date de derniere modification. */
};

/** Evenement enrichi avec ses categories. */
export type EventWithCategories = Event & {
  categories: EventCategory[]; /** Liste des categories associees. */
};