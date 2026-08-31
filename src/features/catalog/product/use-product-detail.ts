"use client";

import type { StorefrontCatalogReader } from "@/lib/storefront/catalog";
import { useStorefrontProductDetail } from "@/lib/storefront/use-storefront-product-detail";

import type { ItemDetailView } from "./item-types";
import {
  ItemDetailMappingError,
  mapStorefrontProductDetail,
} from "./map-storefront-product";

export type ProductDetailResource =
  | { status: "loading" }
  | { status: "not-found"; retry: () => Promise<unknown> }
  | { status: "error"; message: string; retry: () => Promise<unknown> }
  | {
      status: "ready";
      data: ItemDetailView;
      refreshing: boolean;
      refreshMessage?: string;
      retry: () => Promise<unknown>;
    };

export interface UseProductDetailOptions {
  enabled?: boolean;
  catalogMode: "fixture" | "live";
  locale: string;
  cacheScope?: string;
  reader?: Pick<StorefrontCatalogReader, "products">;
}

const fixtureProductReader: Pick<StorefrontCatalogReader, "products"> = {
  products: {
    async get(locationId, productId) {
      const { fixtureStorefrontCatalogReader } = await import(
        "@/fixtures/storefront-catalog"
      );
      return fixtureStorefrontCatalogReader.products.get(locationId, productId);
    },
  },
};

export function useProductDetail(
  locationId: string,
  productId: string,
  {
    enabled = true,
    catalogMode,
    locale,
    cacheScope,
    reader,
  }: UseProductDetailOptions,
): ProductDetailResource {
  const resource = useStorefrontProductDetail(locationId, productId, {
    enabled,
    cacheScope:
      cacheScope ??
      (catalogMode === "fixture" ? "fixture:fixture-base" : undefined),
    reader:
      reader ??
      (catalogMode === "fixture"
        ? fixtureProductReader
        : undefined),
  });

  if (resource.status === "loading") return resource;
  if (resource.status === "error") {
    return {
      status: "error",
      message: resource.error.message,
      retry: resource.retry,
    };
  }
  if (resource.status === "not-found") return resource;

  try {
    return {
      status: "ready",
      data: mapStorefrontProductDetail(resource.data, locale),
      refreshing: resource.refreshing,
      refreshMessage: resource.refreshError?.message,
      retry: resource.retry,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ItemDetailMappingError
          ? "The item customization data is unavailable."
          : "The item is temporarily unavailable.",
      retry: resource.retry,
    };
  }
}
