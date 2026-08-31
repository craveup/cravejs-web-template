import "server-only";

import {
  createStorefrontStoreDirectory,
  type StorefrontStoreDirectory,
} from "./store-directory";

export async function getStorefrontServerStoreDirectory(): Promise<StorefrontStoreDirectory> {
  const { storefrontServerClient } = await import("./server-client");
  return createStorefrontStoreDirectory(storefrontServerClient);
}
