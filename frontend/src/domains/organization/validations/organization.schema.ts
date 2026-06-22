import { z } from "zod";

import { CATEGORIES } from "../types/organization-categories";

const optionalUrlSchema = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || URL.canParse(value), message);

const optionalCoordinateSchema = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (value === "") return true;

      const numberValue = Number(value);
      return !Number.isNaN(numberValue) && numberValue >= min && numberValue <= max;
    }, `${label} doit etre comprise entre ${min} et ${max}`);

export const organizationFormSchema = z.object({
  name: z.string().trim().min(2, "Le nom de l'organisation est requis"),
  contact_email: z.email("Email de contact invalide"),
  description: z
    .string()
    .trim()
    .min(10, "La description doit contenir au moins 10 caracteres"),
  website: optionalUrlSchema("URL du site invalide"),
  latitude: optionalCoordinateSchema(-90, 90, "La latitude"),
  longitude: optionalCoordinateSchema(-180, 180, "La longitude"),
  address: z.string().trim().min(5, "Adresse requise"),
  city: z.string().trim().min(2, "Ville requise"),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Le code postal doit contenir 5 chiffres"),
  logo: optionalUrlSchema("URL du logo invalide"),
  contact_phone_number: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d{10}$/.test(value),
      "Le telephone doit contenir 10 chiffres",
    ),
  siret: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d{14}$/.test(value),
      "Le SIRET doit contenir 14 chiffres",
    ),
  categories: z
    .array(z.enum(CATEGORIES))
    .min(1, "Selectionnez au moins une categorie"),
});

