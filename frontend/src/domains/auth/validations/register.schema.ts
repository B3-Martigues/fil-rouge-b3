/**Schéma de validation pour l'inscription. Utilise Zod pour valider les données côté client
 * Inclut règles de sécurité pour le mot de passe */
import { z } from "zod";

export const registerSchema = z
  .object({
    /**Nom d'utilisateur obligatoire */
    username: z.string().min(2, "Nom d'utilisateur trop court"),

    /**Email valide requis */
    email: z
      .email({ message: "Format d'email invalide" })
      .nonempty("Email requis"),

    /**Type de compte sélectionné par l'utilisateur */
    accountType: z.enum(["user", "company"], {
      message: "Type de compte requis",
    }),

    /**Mot de passe avec régles de sécurité renforcées */
    password: z
      .string()
      .min(8, "Minimum 8 caractères")
      .regex(/[a-z]/, "Une minuscule requise")
      .regex(/[A-Z]/, "Une majuscule requise")
      .regex(/[0-9]/, "Un chiffre requis")
      .regex(/[^a-zA-Z0-9]/, "Un caractère spécial requis"),

    /**Confirmation du mot de passe */
    confirmPassword: z.string().min(1, "Confirmation requise"),
  })
  /**Vérifie que les deux mots de passe sont identiques */
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;
