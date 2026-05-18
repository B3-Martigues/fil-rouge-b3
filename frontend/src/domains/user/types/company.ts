/**
 * Ce fichier contient les types TypeScript liés aux entreprises.
 * L'objectif est de centraliser la structure des données (Company, Category)
 * pour assurer la cohérence dans toute l'application frontend.
 */

/** Type représentant une catégorie d'entreprise */
export type Category = {
  id: number; /** Identifiant unique de la catégorie */
  name: string; /** Nom affiché de la catégorie */
  slug: string; /** Nom simplifié utilisé dans les URLs ou les requêtes */
};

/** Type principal représentant une entreprise */
export type Company = {
  id: number; /** Identifiant unique de l'entreprise */
  name: string; /** Nom de l'entreprise */
  email: string; /** Adresse email utilisée pour la connexion */
  password_hash: string; /** Mot de passe hashé côté backend */
  description: string; /** Description de l'entreprise */
  website: string; /** Site web de l'entreprise */
  address: string; /** Adresse de l'entreprise */
  logo: string; /** URL ou chemin du logo */
  phone_number: number; /** Numéro de téléphone */
  siret: string; /** Numéro SIRET de l'entreprise */
  is_verified: boolean; /** Indique si l'entreprise a été vérifiée */
  is_active: boolean; /** Indique si le compte est actif */
  created_at: string; /** Date de création */
  updated_at: string; /** Date de dernière modification */
  categories: Category[]; /** Catégories associées à l'entreprise */
};

/** Entreprise stockée côté frontend après authentification */
export type AuthenticatedCompany = Omit<Company, "password_hash">;