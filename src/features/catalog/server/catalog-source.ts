import {
  fixtureMenuBundle,
  fixtureMenuProducts,
  fixtureProductsById,
} from "@/fixtures/catalog";
import { fixtureLocation } from "@/fixtures/location";
import { fixtureHostedConfig } from "@/fixtures/storefront-config";
import { mapStorefrontProduct } from "@/lib/storefront/catalog";

import type { ItemDetailView } from "../product/item-types";
import { mapStorefrontProductDetail } from "../product/map-storefront-product";

export interface CatalogLocationRecord {
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
}

export interface CatalogProductRecord {
  id: string;
  name: string;
  description?: string;
  imageSrc?: string;
  formattedPrice: string;
  available: boolean;
}

export interface CatalogCategoryRecord {
  id: string;
  name: string;
  description?: string;
  productIds: string[];
}

export interface MenuCategoryRecord {
  id: string;
  name: string;
  imageSrc?: string;
  hoursLabel?: string;
}

export interface CatalogMenuBundleRecord {
  products: CatalogProductRecord[];
  categories: CatalogCategoryRecord[];
  featuredProductIds: string[];
  menuCategories: MenuCategoryRecord[];
}

export interface CatalogSource {
  locations: {
    getById(locationId: string): Promise<CatalogLocationRecord | null>;
  };
  menus: {
    list(
      locationId: string,
      options: { menuOnly: true },
    ): Promise<CatalogMenuBundleRecord>;
  };
  products: {
    get(locationId: string, productId: string): Promise<ItemDetailView | null>;
  };
}

export class CatalogSourceError extends Error {
  constructor(
    message: string,
    readonly kind: "rate-limited" | "unavailable",
  ) {
    super(message);
    this.name = "CatalogSourceError";
  }
}

const products = fixtureMenuProducts.map((product) => ({
  id: product.id,
  name: product.name,
  description: product.description,
  imageSrc: product.images?.[0],
  formattedPrice: product.displayPrice,
  available: product.availability === "available",
})) satisfies CatalogProductRecord[];

const categoryDescriptions: Record<string, string | undefined> = {
  burgers: "Made to order sandwiches and burgers.",
  sides: "Something crisp for the table.",
};

const primaryMenu = fixtureMenuBundle.menus[0];
if (!primaryMenu) throw new Error("The canonical fixture menu bundle is empty.");

const menuBundle: CatalogMenuBundleRecord = {
  products,
  categories: primaryMenu.categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: categoryDescriptions[category.id],
    productIds: category.products.map((product) => product.id),
  })),
  featuredProductIds: fixtureMenuProducts.map((product) => product.id),
  menuCategories: fixtureMenuBundle.menus.map((menu) => ({
    id: menu.id,
    name: menu.name,
    imageSrc: menu.imageUrl,
    hoursLabel: menu.time,
  })),
};

const emptyBundle: CatalogMenuBundleRecord = {
  products: [],
  categories: [],
  featuredProductIds: [],
  menuCategories: [],
};

export function createFixtureCatalogSource(locale: string): CatalogSource {
  const productDetails = new Map(
    Object.values(fixtureProductsById).map((product) => [
      product.id,
      mapStorefrontProductDetail(mapStorefrontProduct(product), locale),
    ]),
  );

  return {
    locations: {
      async getById(locationId) {
        if (!["demo", "empty", "rate-limited", "error"].includes(locationId)) {
          return null;
        }

        return {
          id: locationId,
          name: fixtureLocation.restaurantDisplayName,
          addressLabel: fixtureLocation.addressString,
          statusLabel: "Open now - Closes at 11:00 PM",
          heroImageSrc: fixtureLocation.coverPhoto,
          serviceHeroImageSrc: "/assets/template/storefront-hero.svg",
          fulfillmentSummary: [
            { id: "fee", label: "Pickup fee", value: "$0" },
            { id: "ready", label: "Ready for pickup", value: "11:30 AM" },
            { id: "minimum", label: "Minimum", value: "$15" },
          ],
          promotionLabel: "Buy 1, get 1 free for eligible items",
          sessionContextLabel: "Your Hotel · Room 324",
          sessionActionLabel: "Change room",
          serviceTitle: "Your Hotel In-Room Dining",
          serviceEyebrow: "Pricing & Fees",
          serviceEstimateLabel: "12–22 min",
          serviceEstimateDescription: "est. delivery time to your door",
        };
      },
    },
    menus: {
      async list(locationId, options) {
        if (!options.menuOnly) {
          throw new CatalogSourceError(
            "First paint must request menu-only data.",
            "unavailable",
          );
        }
        if (locationId === "rate-limited") {
          throw new CatalogSourceError("Please try again shortly.", "rate-limited");
        }
        if (locationId === "error") {
          throw new CatalogSourceError(
            "The menu is temporarily unavailable.",
            "unavailable",
          );
        }
        return locationId === "empty" ? emptyBundle : menuBundle;
      },
    },
    products: {
      async get(locationId, productId) {
        if (locationId === "rate-limited") {
          throw new CatalogSourceError("Please try again shortly.", "rate-limited");
        }
        if (locationId === "error") {
          throw new CatalogSourceError(
            "The item is temporarily unavailable.",
            "unavailable",
          );
        }
        if (locationId === "empty") return null;
        return productDetails.get(productId) ?? null;
      },
    },
  };
}

export const fixtureCatalogSource = createFixtureCatalogSource(
  fixtureHostedConfig.locale,
);
