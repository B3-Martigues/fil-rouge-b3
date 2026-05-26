import { z } from "zod";

export const changePasswordSchema = z
  .object({
    /**Ancien mot de passe */
    oldPassword: z.string().min(1, "Ancien mot de passe requis"),

    /**Nouveau mot de passe avec mêmes règles que register */
    newPassword: z
      .string()
      .min(8, "Minimum 8 caractères")
      .regex(/[a-z]/, "Une minuscule requise")
      .regex(/[A-Z]/, "Une majuscule requise")
      .regex(/[0-9]/, "Un chiffre requis")
      .regex(/[^a-zA-Z0-9]/, "Un caractère spécial requis"),

    /**Confirmation */
    confirmPassword: z.string().min(1, "Confirmation requise"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;