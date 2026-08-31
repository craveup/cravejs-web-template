"use client";

import type { ResolvedStorefrontConfig } from "@/config/storefront-config";
import { clearCustomerToken } from "@/lib/storefront/customer-session";
import { storefrontClient } from "@/lib/storefront/browser-client";
import { setActiveStorefrontMerchant } from "@/lib/storefront/session-store";

import { createStorefrontLoyaltyActions } from "./loyalty-actions";

export type StorefrontLoyaltyRuntimeConfig = Pick<
  ResolvedStorefrontConfig,
  "tenantId" | "merchantSlug" | "capabilities"
>;

export function createBrowserStorefrontLoyaltyActions(
  config: StorefrontLoyaltyRuntimeConfig,
) {
  return createStorefrontLoyaltyActions(
    storefrontClient,
    {
      tenantId: config.tenantId,
      merchantSlug: config.merchantSlug,
      profileEnabled: config.capabilities.loyalty,
    },
    {
      setMerchantScope: setActiveStorefrontMerchant,
      clearCustomerToken,
    },
  );
}
