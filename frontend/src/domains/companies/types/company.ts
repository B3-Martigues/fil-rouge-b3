import type { CompanyCategoryOption } from "./company-categories";

/**
 * Structure des donnees liees aux entreprises.
 * Les categories sont stockees sous forme d'objets pour garder leur id et slug.
 */

/** Categorie rattachee a une entreprise. */
export type Category = CompanyCategoryOption;

/** Type principal representant une entreprise. */
export type Company = {
  id: number; /** Identifiant unique de l'entreprise. */
  name: string; /** Nom de l'entreprise. */
  email: string; /** Adresse email utilisee pour la connexion. */
  password_hash: string; /** Mot de passe hashe cote backend. */
  description: string; /** Description de l'entreprise. */
  website: string; /** Site web de l'entreprise. */
  address: string; /** Adresse de l'entreprise. */
  logo: string; /** URL ou chemin du logo. */
  phone_number: number; /** Numero de telephone. */
  siret: string; /** Numero SIRET de l'entreprise. */
  is_verified: boolean; /** Indique si l'entreprise a ete verifiee. */
  is_active: boolean; /** Indique si le compte est actif. */
  created_at: string; /** Date de creation. */
  updated_at: string; /** Date de derniere modification. */
  categories: Category[]; /** Categories associees a l'entreprise. */
};

/** Entreprise stockee cote frontend apres authentification. */
export type AuthenticatedCompany = Omit<Company, "password_hash">;