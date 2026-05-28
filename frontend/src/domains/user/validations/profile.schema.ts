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
 /** Mot de passe (optionnel si pas modifié) */
  oldPassword: z.string().optional(),

  newPassword: z.string().optional(),

  confirmPassword: z.string().optional(),
})
.refine((data) => {
  // si l'utilisateur veut changer le mdp
  if (data.newPassword || data.confirmPassword || data.oldPassword) {
    return data.oldPassword && data.newPassword && data.confirmPassword;
  }
  return true;
}, {
  message: "Veuillez remplir tous les champs mot de passe",
})
.refine((data) => {
  if (data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Les mots de passe ne correspondent pas",
});

export type ProfileFormData = z.infer<typeof profileSchema>;