import { z } from "zod";

export const profileSchema = z.object({
  username: z.string().min(2, "Nom utilisateur trop court"),
  login_email: z
    .email({ message: "Format d'email invalide" })
    .nonempty("Email requis"),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
