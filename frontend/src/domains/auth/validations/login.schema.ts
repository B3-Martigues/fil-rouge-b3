/**Schéma de validation pour les formulaires d'authentification.
 * Utilise Zod pour valider les données côté client
 */

import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ message: "Format d'email invalide" }),

  password: z.string().min(1, "Mot de passe requis"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
