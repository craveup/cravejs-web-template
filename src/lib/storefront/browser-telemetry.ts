"use client";

import type { ResolvedStorefrontConfig } from "@/config/storefront-config";

import { storefrontClient } from "./browser-client";
import { setActiveStorefrontMerchant } from "./session-store";
import {
  createStorefrontTelemetryActions,
  type StorefrontTelemetryPolicy,
} from "./telemetry";

export type StorefrontTelemetryRuntimeConfig = Pick<
  ResolvedStorefrontConfig,
  "profile" | "tenantId" | "merchantSlug"
>;

export function createBrowserStorefrontTelemetryActions(
  config: StorefrontTelemetryRuntimeConfig,
  policy: StorefrontTelemetryPolicy,
) {
  return createStorefrontTelemetryActions(
    storefrontClient,
    config,
    policy,
    { setMerchantScope: setActiveStorefrontMerchant },
  );
}
