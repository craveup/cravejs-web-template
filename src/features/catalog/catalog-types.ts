export type StoreHomeVariant =
  | "home"
  | "category-scroll"
  | "menu-categories"
  | "full-menu";

export type CatalogAvailability = "available" | "unavailable";

export interface CatalogItemView {
  id: string;
  href: string;
  name: string;
  description?: string;
  imageSrc?: string;
  formattedPrice: string;
  availability: CatalogAvailability;
  categoryId: string;
  categoryName: string;
}

export interface CatalogCategoryView {
  id: string;
  name: string;
  description?: string;
  items: CatalogItemView[];
}

export interface MenuCategoryView {
  id: string;
  name: string;
  imageSrc?: string;
  hoursLabel?: string;
}

export interface OrderRailView {
  itemCountLabel: string;
  totalLabel: string;
  items: Array<{
    id: string;
    name: string;
    formattedPrice: string;
    imageSrc?: string;
  }>;
  rows: Array<{
    id: string;
    label: string;
    formattedValue: string;
  }>;
  formattedTotal: string;
  actionLabel: string;
}

export interface StoreHomeData {
  location: {
    id: string;
    name: string;
    addressLabel?: string;
    statusLabel?: string;
    heroImageSrc?: string;
    serviceHeroImageSrc?: string;
    fulfillmentSummary?: Array<{ id: string; label: string; value: string }>;
    promotionLabel?: string;
    sessionContextLabel?: string;
    sessionActionLabel?: string;
    serviceTitle?: string;
    serviceEyebrow?: string;
    serviceEstimateLabel?: string;
    serviceEstimateDescription?: string;
  };
  categories: CatalogCategoryView[];
  featuredItems: CatalogItemView[];
  menuCategories: MenuCategoryView[];
  orderRail?: OrderRailView;
}

export interface CatalogSearchIndex {
  categories: Array<{ id: string; name: string }>;
  items: CatalogItemView[];
}

export function createCatalogSearchIndex(data: StoreHomeData): CatalogSearchIndex {
  return {
    categories: data.categories.map(({ id, name }) => ({ id, name })),
    items: data.categories.flatMap((category) => category.items),
  };
}
