import type { StorefrontCatalogReader } from "@/lib/storefront/catalog";
import { StorefrontCatalogReadError } from "@/lib/storefront/catalog";

import { mapStorefrontProductDetail } from "../product/map-storefront-product";
import {
  CatalogSourceError,
  type CatalogMenuBundleRecord,
  type CatalogSource,
} from "./catalog-source";

function mapReadError(error: unknown): never {
  if (error instanceof StorefrontCatalogReadError) {
    throw new CatalogSourceError(
      error.message,
      error.state === "rate-limited" ? "rate-limited" : "unavailable",
    );
  }
  throw error;
}

function mapMenuBundle(
  bundle: Awaited<ReturnType<StorefrontCatalogReader["menus"]["list"]>>,
): CatalogMenuBundleRecord {
  const products = new Map<
    string,
    CatalogMenuBundleRecord["products"][number]
  >();
  const categories: CatalogMenuBundleRecord["categories"] = [];

  for (const menu of bundle.menus) {
    for (const category of menu.categories) {
      categories.push({
        id: category.id,
        name: category.name,
        productIds: category.products.map((product) => product.id),
      });
      for (const product of category.products) {
        if (products.has(product.id)) continue;
        products.set(product.id, {
          id: product.id,
          name: product.name,
          description: product.description || undefined,
          imageSrc: product.images.find((image) => image.length > 0),
          formattedPrice: product.displayPrice,
          available: product.availability === "available",
        });
      }
    }
  }

  return {
    products: Array.from(products.values()),
    categories,
    featuredProductIds: bundle.popularProducts.map((product) => product.id),
    menuCategories: bundle.menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      imageSrc: menu.imageUrl || undefined,
      hoursLabel: menu.hoursLabel || undefined,
    })),
  };
}

export function createStorefrontCatalogSource(
  reader: StorefrontCatalogReader,
  locale: string,
): CatalogSource {
  return {
    locations: {
      async getById(locationId) {
        try {
          const location = await reader.locations.getById(locationId);
          if (!location) return null;
          return {
            id: location.id,
            name: location.name,
            addressLabel: location.addressLabel || undefined,
            heroImageSrc: location.coverImageUrl || undefined,
          };
        } catch (error) {
          mapReadError(error);
        }
      },
    },
    menus: {
      async list(locationId, options) {
        try {
          return mapMenuBundle(await reader.menus.list(locationId, options));
        } catch (error) {
          mapReadError(error);
        }
      },
    },
    products: {
      async get(locationId, productId) {
        try {
          const product = await reader.products.get(locationId, productId);
          return product ? mapStorefrontProductDetail(product, locale) : null;
        } catch (error) {
          mapReadError(error);
        }
      },
    },
  };
}

export async function getStorefrontCatalogSource(
  locale: string,
): Promise<CatalogSource> {
  const { getStorefrontServerCatalogReader } = await import(
    "@/lib/storefront/server-catalog"
  );
  return createStorefrontCatalogSource(
    await getStorefrontServerCatalogReader(),
    locale,
  );
}
