import { z } from "zod";

export const forgotPasswordSchema = z.object({
  login_email: z.email({ message: "Format d'email invalide" }),
});

export const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Minimum 8 caracteres")
      .regex(/[a-z]/, "Une minuscule requise")
      .regex(/[A-Z]/, "Une majuscule requise")
      .regex(/[0-9]/, "Un chiffre requis")
      .regex(/[^a-zA-Z0-9]/, "Un caractere special requis"),
    confirmPassword: z.string().min(1, "Confirmation requise"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
