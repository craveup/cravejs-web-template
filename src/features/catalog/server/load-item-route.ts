import type { CatalogItemView, StoreHomeData } from "../catalog-types";
import type { CatalogSource } from "./catalog-source";
import { loadStoreHomeData } from "./load-store-home";

export class CatalogItemNotFoundError extends Error {
  constructor(
    readonly locationId: string,
    readonly productId: string,
  ) {
    super(`Product ${productId} was not found at location ${locationId}.`);
    this.name = "CatalogItemNotFoundError";
  }
}

export interface ItemRouteData {
  store: StoreHomeData;
  item: CatalogItemView;
  similarItems: CatalogItemView[];
  recommendations: CatalogItemView[];
}

export async function loadItemRouteData(
  locationId: string,
  productId: string,
  source: CatalogSource,
): Promise<ItemRouteData> {
  const store = await loadStoreHomeData(locationId, source);
  const category = store.categories.find((candidate) =>
    candidate.items.some((item) => item.id === productId),
  );
  const item = category?.items.find((candidate) => candidate.id === productId);
  if (!category || !item) throw new CatalogItemNotFoundError(locationId, productId);

  const recommendationIds = new Set([productId]);
  const recommendations: CatalogItemView[] = [];
  for (const candidate of store.categories.flatMap((entry) => entry.items)) {
    if (
      candidate.availability !== "available" ||
      recommendationIds.has(candidate.id)
    ) {
      continue;
    }
    recommendationIds.add(candidate.id);
    recommendations.push(candidate);
    if (recommendations.length === 3) break;
  }

  return {
    store,
    item,
    similarItems: category.items
      .filter((candidate) => candidate.id !== productId && candidate.availability === "available")
      .slice(0, 3),
    recommendations,
  };
}
