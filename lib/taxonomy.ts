export const CATEGORIES = [
  "Beverage",
  "Snack",
  "Instant Food",
  "Food",
  "Personal Care",
  "Household",
  "Other"
] as const;

export const PACKAGING_TYPES = [
  "Bottle",
  "Sachet",
  "Wrapper",
  "Cup",
  "Can",
  "Carton",
  "Bag",
  "Other"
] as const;

export const MATERIALS = [
  "PET Plastic",
  "Flexible Plastic",
  "Multilayer Plastic",
  "HDPE Plastic",
  "PP Plastic",
  "Aluminium",
  "Glass",
  "Paper/Cardboard",
  "Unknown"
] as const;

// Stable names used by the frontend integration contract.
export const CATEGORY_OPTIONS = CATEGORIES;
export const PACKAGING_OPTIONS = PACKAGING_TYPES;
export const MATERIAL_OPTIONS = MATERIALS;

export type Category = (typeof CATEGORIES)[number];
export type PackagingType = (typeof PACKAGING_TYPES)[number];
export type LikelyMaterial = (typeof MATERIALS)[number];

export function isTaxonomyValue<T extends readonly string[]>(
  value: unknown,
  options: T
): value is T[number] {
  return typeof value === "string" && options.includes(value as T[number]);
}

export function normalizeToTaxonomy<T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: T[number]
): T[number] {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return options.find(option => option.toLowerCase() === normalized) ?? fallback;
}
