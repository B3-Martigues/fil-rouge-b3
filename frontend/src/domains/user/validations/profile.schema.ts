/**
 * Schéma de validation du profil utilisateur.
 * Utilise Zod pour valider les données côté client.
 */

import { z } from "zod";

export const profileSchema = z.object({
  /**Nom utilisateur obligatoire */
  username: z.string().min(2, "Nom utilisateur trop court"),

  /**Adresse email valide */
  email: z
    .email({ message: "Format d'email invalide" })
    .nonempty("Email requis"),
});

export type ProfileFormData = z.infer<typeof profileSchema>;