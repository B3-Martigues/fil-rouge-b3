/**
 * Ce fichier contient les types TypeScript liés aux événements.
 * L'objectif est de centraliser la structure des données (Event)
 * pour assurer la cohérence dans toute l'application frontend.
 */

/**Type principal représentant un événement */
export type Event = {
  id: number; /**Identifiant unique de l'événement */
  company_id: number; /**Identifiant de l'entreprise ayant créé l'événement */
  title: string; /**Titre de l'événement */
  description: string; /**Description de l'événement */
  date: string; /**Date et heure de l'événement */
  latitude: number; /**Latitude du lieu */
  longitude: number; /**Longitude du lieu */
  address: string; /**Adresse complète de l'événement */
  image: string; /**Image de l'événement */
  source: string; /**Source de l'événement (API, scraping, manuel, etc.) */
  created_at: string; /**Date de création */
  updated_at: string; /**Date de dernière modification */
};

/**Événement enrichi avec ses catégories */
export type EventWithCategories = Event & {
  categories: string[]; /**Liste des catégories associées */
};