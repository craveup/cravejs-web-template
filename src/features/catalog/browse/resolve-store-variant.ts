import type { StoreHomeVariant } from "../catalog-types";

const demoVariants = new Set<StoreHomeVariant>([
  "home",
  "category-scroll",
  "menu-categories",
  "full-menu",
]);

export function resolveStoreVariant(
  locationId: string,
  requestedVariant: string | string[] | undefined,
): StoreHomeVariant {
  if (
    locationId === "demo" &&
    typeof requestedVariant === "string" &&
    demoVariants.has(requestedVariant as StoreHomeVariant)
  ) {
    return requestedVariant as StoreHomeVariant;
  }

  return "home";
}
