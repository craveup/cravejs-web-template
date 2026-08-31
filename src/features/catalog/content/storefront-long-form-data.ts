import type { StorefrontLongFormContent } from "@/content/storefront-long-form";

import type { CatalogItemView, StoreHomeData } from "../catalog-types";

export interface StorefrontLongFormData {
  readonly location: {
    readonly id: string;
    readonly name: string;
    readonly addressLabel?: string;
  };
  readonly items: readonly CatalogItemView[];
}

export function createStorefrontLongFormData(
  store: StoreHomeData,
  content: StorefrontLongFormContent,
): StorefrontLongFormData {
  const menuItems = store.categories.flatMap((category) => category.items);
  const itemsById = new Map(menuItems.map((item) => [item.id, item]));
  const selected: CatalogItemView[] = [];
  const selectedIds = new Set<string>();

  for (const productId of content.editorialProductIds) {
    const item = itemsById.get(productId);
    if (
      !item ||
      item.availability !== "available" ||
      selectedIds.has(item.id)
    ) {
      continue;
    }
    selected.push(item);
    selectedIds.add(item.id);
    if (selected.length === 4) break;
  }

  for (const item of menuItems) {
    if (
      selected.length === 4 ||
      selectedIds.has(item.id) ||
      item.availability !== "available"
    ) {
      continue;
    }
    selected.push(item);
    selectedIds.add(item.id);
  }

  return {
    location: {
      id: store.location.id,
      name: store.location.name,
      ...(store.location.addressLabel
        ? { addressLabel: store.location.addressLabel }
        : {}),
    },
    items: selected,
  };
}
