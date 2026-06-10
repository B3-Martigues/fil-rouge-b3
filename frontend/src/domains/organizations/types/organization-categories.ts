export const ORGANIZATION_CATEGORIES = [
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

export const CATEGORIES = ORGANIZATION_CATEGORIES;

export type OrganizationCategoryName = (typeof ORGANIZATION_CATEGORIES)[number];
export type CategoryName = OrganizationCategoryName;
export type OrganizationCategory = OrganizationCategoryName;

export type OrganizationCategoryOption = {
  id: number;
  name: OrganizationCategoryName;
  slug: string;
};

export type CategoryOption = OrganizationCategoryOption;
