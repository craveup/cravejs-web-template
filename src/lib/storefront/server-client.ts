import "server-only";

import { createStorefrontClient } from "@craveup/storefront-sdk";

import { resolveStorefrontApiBaseUrl } from "./config";

export const storefrontServerClient = createStorefrontClient({
  baseUrl: resolveStorefrontApiBaseUrl(
    process.env.NEXT_PUBLIC_CRAVEUP_API_URL,
  ),
});
