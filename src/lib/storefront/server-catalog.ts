import "server-only";

import {
  createStorefrontCatalogReader,
  type StorefrontCatalogReader,
} from "./catalog";

export async function getStorefrontServerCatalogReader(): Promise<StorefrontCatalogReader> {
  const { storefrontServerClient } = await import("./server-client");
  return createStorefrontCatalogReader(storefrontServerClient);
}
