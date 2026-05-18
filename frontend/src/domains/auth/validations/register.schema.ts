import { z } from "zod";

import { CATEGORIES } from "../../user/types/category";

const passwordSchema = z
  .string()
  .min(8, "Minimum 8 caracteres")
  .regex(/[a-z]/, "Une minuscule requise")
  .regex(/[A-Z]/, "Une majuscule requise")
  .regex(/[0-9]/, "Un chiffre requis")
  .regex(/[^a-zA-Z0-9]/, "Un caractere special requis");

export const registerSchema = z
  .object({
    username: z.string().min(2, "Nom d'utilisateur trop court"),
    email: z
      .email({ message: "Format d'email invalide" })
      .nonempty("Email requis"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmation requise"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const companyRegisterSchema = z
  .object({
    name: z.string().min(2, "Nom de l'entreprise requis"),
    email: z
      .email({ message: "Format d'email invalide" })
      .nonempty("Email requis"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmation requise"),
    description: z.string().min(10, "Description trop courte"),
    website: z.string().url("URL du site invalide"),
    address: z.string().min(5, "Adresse requise"),
    logo: z.string().url("URL du logo invalide"),
    phone_number: z
      .string()
      .regex(/^\d{10}$/, "Le telephone doit contenir 10 chiffres"),
    siret: z.string().regex(/^\d{14}$/, "Le SIRET doit contenir 14 chiffres"),
    categories: z
      .array(z.enum(CATEGORIES))
      .min(1, "Selectionnez au moins une categorie"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type CompanyRegisterFormData = z.infer<typeof companyRegisterSchema>;
