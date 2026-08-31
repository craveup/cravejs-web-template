import type { MetadataRoute } from "next";

import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";
import { loadStorefrontMerchantDirectory } from "@/lib/tenant/server-storefront-seo";
import { createStorefrontSitemap } from "@/lib/tenant/storefront-seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const runtime = await readRequestStorefrontRuntime();
  if (!runtime || runtime.mode === "fixture") return [];

  const merchant = await loadStorefrontMerchantDirectory(runtime);
  return merchant
    ? createStorefrontSitemap(
        runtime.config,
        merchant.locations.map(({ id }) => id),
      )
    : [];
}
