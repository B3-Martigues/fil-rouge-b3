export const COMPANY_CATEGORIES = [
  "art",
  "associatif",
  "bien-etre",
  "business",
  "culture",
  "famille",
  "formation",
  "gaming",
  "gastronomie",
  "musique",
  "nature",
  "sport",
  "soiree",
  "technologie",
  "tourisme",
] as const;

export const CATEGORIES = COMPANY_CATEGORIES;

export type CompanyCategoryName = (typeof COMPANY_CATEGORIES)[number];
export type CategoryName = CompanyCategoryName;
export type CompanyCategory = CompanyCategoryName;

export type CompanyCategoryOption = {
  id: number;
  name: CompanyCategoryName;
  slug: string;
};

export type CategoryOption = CompanyCategoryOption;
