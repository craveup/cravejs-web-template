import "server-only";

import type { StorefrontMerchantDirectory } from "../storefront/store-directory";
import type { StorefrontRuntime } from "./storefront-runtime";

export async function loadStorefrontMerchantDirectory(
  runtime: StorefrontRuntime,
): Promise<StorefrontMerchantDirectory | null> {
  if (runtime.mode === "fixture") {
    const { createFixtureStoreDirectory } = await import(
      "../../fixtures/store-directory"
    );
    return createFixtureStoreDirectory(runtime).merchant.getBySlug(
      runtime.config.merchantSlug,
    );
  }

  const { getStorefrontServerStoreDirectory } = await import(
    "../storefront/server-store-directory"
  );
  return (await getStorefrontServerStoreDirectory()).merchant.getBySlug(
    runtime.config.merchantSlug,
  );
}
