import type { MetadataRoute } from "next";

import { readRequestStorefrontRuntime } from "@/lib/tenant/server-storefront-runtime";
import { createStorefrontRobots } from "@/lib/tenant/storefront-seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return createStorefrontRobots(await readRequestStorefrontRuntime());
}
