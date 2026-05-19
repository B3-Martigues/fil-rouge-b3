import type { Company } from "../types/company";

export const companiesMock: Company[] = [
  {
    id: 3,
    name: "CompanyOwner",
    email: "company@gmail.com",
    password_hash: "12341234",
    description: "Entreprise de demonstration en attente de validation admin.",
    website: "https://company.example",
    address: "10 rue de la Demo, 13001 Marseille",
    logo: "https://images.unsplash.com/photo-1560179707-f14e90ef3623",
    phone_number: 612345678,
    siret: "12345678901234",
    is_verified: false,
    is_active: false,
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z",
    categories: [
      { id: 1, name: "culture", slug: "culture" },
      { id: 2, name: "musique", slug: "musique" },
    ],
  },
];
