import type { CompanyCategoryName, CompanyCategoryOption } from "./company-categories";

export type Company = {
  id: number;
  account_id: number;
  name: string;
  contact_email: string;
  role_id?: number | null;
  description?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address: string;
  city: string;
  postal_code: string;
  logo?: string | null;
  contact_phone_number?: string | null;
  siret?: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  category_slugs: CompanyCategoryName[];
};

export type CompanyWithCategories = Company & {
  categories: CompanyCategoryOption[];
};

export type AuthenticatedCompany = Company;
