import { z } from "zod";

const passwordRules = [
  {
    test: (value: string) => value.length >= 8,
    message: "Minimum 8 caracteres",
  },
  {
    test: (value: string) => /[a-z]/.test(value),
    message: "Une minuscule requise",
  },
  {
    test: (value: string) => /[A-Z]/.test(value),
    message: "Une majuscule requise",
  },
  {
    test: (value: string) => /[0-9]/.test(value),
    message: "Un chiffre requis",
  },
  {
    test: (value: string) => /[^a-zA-Z0-9]/.test(value),
    message: "Un caractere special requis",
  },
];

export const profileSchema = z
  .object({
    username: z.string().min(2, "Nom utilisateur trop court"),
    login_email: z
      .email({ message: "Format d'email invalide" })
      .nonempty("Email requis"),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const newPassword = data.newPassword?.trim() ?? "";
    const confirmPassword = data.confirmPassword?.trim() ?? "";

    if (!newPassword && !confirmPassword) return;

    if (!newPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Nouveau mot de passe requis",
        path: ["newPassword"],
      });
      return;
    }

    passwordRules.forEach((rule) => {
      if (!rule.test(newPassword)) {
        ctx.addIssue({
          code: "custom",
          message: rule.message,
          path: ["newPassword"],
        });
      }
    });

    if (!confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Confirmation requise",
        path: ["confirmPassword"],
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Les mots de passe ne correspondent pas",
        path: ["confirmPassword"],
      });
    }
  });

export type ProfileFormData = z.infer<typeof profileSchema>;
